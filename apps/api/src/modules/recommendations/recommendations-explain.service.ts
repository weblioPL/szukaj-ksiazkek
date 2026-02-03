import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClaudeClient } from '../claude/claude.client';
import { PromptService } from '../claude/prompt.service';
import { PreferencesService } from '../preferences/preferences.service';
import { RecommendationsService } from './recommendations.service';
import {
  ExplainRequest,
  ExplainResponse,
  CompareRequest,
  CompareResponse,
  ExplainContext,
  CompareContext,
  CandidateBookSummary,
  GuardrailResult,
  AllowedBooksContext,
  AlternativeBook,
  ComparedBook,
} from './recommendations-explain.types';
import { RecommendedBook, Recommendation } from './recommendations.types';

/**
 * Recommendations Explain Service
 *
 * Uses Claude to explain recommendations in natural Polish.
 * Claude does NOT generate recommendations - only explains them.
 *
 * Guardrails:
 * - Claude can only discuss books from the catalog
 * - All book suggestions must use IDs from allowed list
 * - Refuses to discuss non-catalog books
 */
@Injectable()
export class RecommendationsExplainService {
  private readonly logger = new Logger(RecommendationsExplainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeClient: ClaudeClient,
    private readonly promptService: PromptService,
    private readonly preferencesService: PreferencesService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /**
   * Explain why a book is recommended
   */
  async explain(userId: string, request: ExplainRequest): Promise<ExplainResponse> {
    // Validate book exists in catalog
    const book = await this.getBookById(request.bookId);
    if (!book) {
      throw new NotFoundException(`Book with ID ${request.bookId} not found in catalog`);
    }

    // Get user preferences
    const preferences = await this.preferencesService.getUserPreferences(userId);

    // Get recommendation score for this book
    const scoring = this.recommendationsService.scoreBook(
      book,
      preferences,
      true, // include debug
    );

    // Get candidate books for "Try also" suggestions
    const recommendations = await this.recommendationsService.getRecommendations(userId, {
      limit: 15,
      debug: true,
    });

    // Build allowed books context (excluding the current book)
    const candidateBooks: CandidateBookSummary[] = recommendations.items
      .filter((r) => r.book.id !== request.bookId)
      .slice(0, 10)
      .map((r) => ({
        id: r.book.id,
        title: r.book.title,
        authors: r.book.authors,
        categories: r.book.categories,
        score: r.score,
      }));

    // Build context for Claude
    const context: ExplainContext = {
      book,
      scoring: scoring.debug,
      categoryAffinities: preferences.categories,
      authorAffinities: preferences.authors,
      formatAffinities: preferences.formats,
      negativeCategories: preferences.negativeSignals.categories.map((c) => c.name),
      negativeAuthors: preferences.negativeSignals.authors.map((a) => a.name),
      readingStats: {
        totalBooks: preferences.stats.totalBooks,
        readCount: preferences.stats.byStatus.read || 0,
        averageRating: preferences.stats.ratings.average,
      },
      candidateBooks,
      userQuestion: request.context,
    };

    // Check if Claude is configured
    if (!this.claudeClient.isConfigured()) {
      // Return algorithmic explanation without AI
      return this.buildFallbackExplanation(book, scoring, candidateBooks, preferences.dataQuality.confidence);
    }

    // Call Claude for explanation
    const explanation = await this.getClaudeExplanation(context);

    // Extract alternative book IDs from Claude's response
    const alternatives = this.extractAlternatives(explanation, candidateBooks);

    return {
      bookId: request.bookId,
      explanation,
      reasons: scoring.reasons,
      confidence: preferences.dataQuality.confidence,
      alternatives,
    };
  }

  /**
   * Compare multiple books and recommend the best fit
   */
  async compare(userId: string, request: CompareRequest): Promise<CompareResponse> {
    // Validate request
    if (!request.bookIds || request.bookIds.length < 2) {
      throw new BadRequestException('At least 2 books are required for comparison');
    }
    if (request.bookIds.length > 5) {
      throw new BadRequestException('Maximum 5 books can be compared at once');
    }

    // Get all books
    const books: RecommendedBook[] = [];
    for (const bookId of request.bookIds) {
      const book = await this.getBookById(bookId);
      if (!book) {
        throw new NotFoundException(`Book with ID ${bookId} not found in catalog`);
      }
      books.push(book);
    }

    // Get user preferences
    const preferences = await this.preferencesService.getUserPreferences(userId);

    // Score each book
    const scoredBooks = books.map((book) => ({
      book,
      ...this.recommendationsService.scoreBook(book, preferences, true),
    }));

    // Build compare context
    const context: CompareContext = {
      books: scoredBooks.map((sb) => ({
        book: sb.book,
        scoring: sb.debug,
        score: sb.score,
      })),
      preferences: {
        topCategories: preferences.categories.slice(0, 3).map((c) => c.name),
        topAuthors: preferences.authors.slice(0, 3).map((a) => a.name),
        preferredFormat: preferences.formats[0]?.format,
      },
      userQuestion: request.question,
    };

    // Find best fit (highest score)
    const sortedByScore = [...scoredBooks].sort((a, b) => b.score - a.score);
    const bestFit = sortedByScore[0];

    // Check if Claude is configured
    if (!this.claudeClient.isConfigured()) {
      return this.buildFallbackComparison(scoredBooks, bestFit);
    }

    // Call Claude for comparison
    const comparison = await this.getClaudeComparison(context);

    return {
      books: scoredBooks.map((sb) => ({
        id: sb.book.id,
        title: sb.book.title,
        authors: sb.book.authors,
        score: sb.score,
        matchedCategories: sb.debug?.matchedCategories || [],
        matchedAuthors: sb.debug?.matchedAuthors || [],
      })),
      comparison,
      bestFitId: bestFit.book.id,
      bestFitReason: `Najwyższy wynik dopasowania: ${(bestFit.score * 100).toFixed(0)}%`,
    };
  }

  /**
   * Validate that a book ID exists in the allowed list
   */
  validateBookInCatalog(bookId: string, allowedContext: AllowedBooksContext): GuardrailResult {
    if (allowedContext.allowedIds.has(bookId)) {
      return { passed: true };
    }

    return {
      passed: false,
      error: 'Book not in catalog',
      suggestedResponse: 'Tej książki nie mam w aktualnych rekomendacjach. Użyj wyszukiwarki, aby ją znaleźć w katalogu.',
    };
  }

  /**
   * Get book by ID with full details
   */
  private async getBookById(bookId: string): Promise<RecommendedBook | null> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        authors: {
          include: { author: true },
        },
        categories: {
          include: { category: true },
        },
        offers: {
          where: { isAvailable: true },
          take: 1,
        },
      },
    });

    if (!book) {
      return null;
    }

    return {
      id: book.id,
      isbn: book.isbn || undefined,
      title: book.title,
      coverUrl: book.coverUrl || undefined,
      description: book.description || undefined,
      authors: book.authors.map((a) => a.author.name),
      categories: book.categories.map((c) => c.category.name),
      formats: {
        paper: book.hasPaper,
        ebook: book.hasEbook,
        audiobook: book.hasAudiobook,
      },
      avgRating: Number(book.avgRating),
      ratingsCount: book.ratingsCount,
      hasOffers: book.offers.length > 0,
    };
  }

  /**
   * Get Claude explanation
   */
  private async getClaudeExplanation(context: ExplainContext): Promise<string> {
    try {
      const systemPrompt = this.promptService.getExplainSystemPrompt();
      const userPrompt = this.promptService.buildExplainPrompt(context);

      const response = await this.claudeClient['client']!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      return response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : this.buildFallbackText(context);
    } catch (error) {
      this.logger.error(`Claude explanation error: ${error}`);
      return this.buildFallbackText(context);
    }
  }

  /**
   * Get Claude comparison
   */
  private async getClaudeComparison(context: CompareContext): Promise<string> {
    try {
      const systemPrompt = this.promptService.getCompareSystemPrompt();
      const userPrompt = this.promptService.buildComparePrompt(context);

      const response = await this.claudeClient['client']!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      return response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : 'Nie udało się wygenerować porównania.';
    } catch (error) {
      this.logger.error(`Claude comparison error: ${error}`);
      return 'Nie udało się wygenerować porównania. Sprawdź wyniki algorytmu powyżej.';
    }
  }

  /**
   * Build fallback explanation when Claude is not available
   */
  private buildFallbackExplanation(
    book: RecommendedBook,
    scoring: Recommendation,
    candidates: CandidateBookSummary[],
    confidence: number,
  ): ExplainResponse {
    const reasons = scoring.reasons;
    let explanation = `Polecamy "${book.title}", ponieważ:\n`;
    explanation += reasons.map((r) => `• ${r}`).join('\n');

    if (candidates.length > 0) {
      explanation += '\n\nSprawdź też:';
      for (const c of candidates.slice(0, 2)) {
        explanation += `\n• "${c.title}" - ${c.authors.join(', ')}`;
      }
    }

    return {
      bookId: book.id,
      explanation,
      reasons,
      confidence,
      alternatives: candidates.slice(0, 2).map((c) => ({
        id: c.id,
        title: c.title,
        authors: c.authors,
        reason: `Podobny wynik dopasowania: ${(c.score * 100).toFixed(0)}%`,
      })),
    };
  }

  /**
   * Build fallback comparison when Claude is not available
   */
  private buildFallbackComparison(
    scoredBooks: Array<{ book: RecommendedBook; score: number; debug?: any }>,
    bestFit: { book: RecommendedBook; score: number },
  ): CompareResponse {
    let comparison = 'Porównanie książek:\n\n';

    for (const sb of scoredBooks) {
      comparison += `"${sb.book.title}" - ${sb.book.authors.join(', ')}\n`;
      comparison += `  Wynik dopasowania: ${(sb.score * 100).toFixed(0)}%\n`;
      if (sb.debug?.matchedCategories?.length > 0) {
        comparison += `  Pasujące kategorie: ${sb.debug.matchedCategories.join(', ')}\n`;
      }
      comparison += '\n';
    }

    comparison += `\nNajlepszy wybór: "${bestFit.book.title}" z wynikiem ${(bestFit.score * 100).toFixed(0)}%`;

    return {
      books: scoredBooks.map((sb) => ({
        id: sb.book.id,
        title: sb.book.title,
        authors: sb.book.authors,
        score: sb.score,
        matchedCategories: sb.debug?.matchedCategories || [],
        matchedAuthors: sb.debug?.matchedAuthors || [],
      })),
      comparison,
      bestFitId: bestFit.book.id,
      bestFitReason: `Najwyższy wynik dopasowania: ${(bestFit.score * 100).toFixed(0)}%`,
    };
  }

  /**
   * Build simple fallback text
   */
  private buildFallbackText(context: ExplainContext): string {
    const book = context.book;
    let text = `Polecamy "${book.title}", ponieważ:\n`;

    if (context.scoring?.matchedCategories?.length) {
      text += `• Lubisz książki z kategorii: ${context.scoring.matchedCategories.join(', ')}\n`;
    }
    if (context.scoring?.matchedAuthors?.length) {
      text += `• Czytałeś już książki autorów: ${context.scoring.matchedAuthors.join(', ')}\n`;
    }
    if (context.scoring?.matchedFormat) {
      text += `• Dostępna w preferowanym formacie: ${context.scoring.matchedFormat}\n`;
    }

    return text;
  }

  /**
   * Extract alternative book suggestions from Claude's response
   *
   * Looks for [ID:uuid] patterns and validates against allowed list
   */
  private extractAlternatives(
    response: string,
    candidates: CandidateBookSummary[],
  ): AlternativeBook[] {
    const alternatives: AlternativeBook[] = [];
    const idPattern = /\[ID:([a-f0-9-]+)\]/gi;
    const matches = response.matchAll(idPattern);
    const allowedIds = new Set(candidates.map((c) => c.id));

    for (const match of matches) {
      const id = match[1];
      if (allowedIds.has(id) && !alternatives.some((a) => a.id === id)) {
        const candidate = candidates.find((c) => c.id === id);
        if (candidate) {
          alternatives.push({
            id: candidate.id,
            title: candidate.title,
            authors: candidate.authors,
            reason: `Podobne zainteresowania`,
          });
        }
      }

      // Limit to 3 alternatives
      if (alternatives.length >= 3) {
        break;
      }
    }

    return alternatives;
  }
}
