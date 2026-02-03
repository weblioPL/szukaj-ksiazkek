import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PreferencesService } from '../preferences/preferences.service';
import {
  UserPreferences,
  CategoryAffinity,
  AuthorAffinity,
  FormatAffinity,
} from '../preferences/preferences.types';
import {
  Recommendation,
  RecommendationResponse,
  RecommendationQuery,
  RecommendedBook,
  RecommendationConfig,
  RecommendationDebug,
  DEFAULT_RECOMMENDATION_CONFIG,
  REASON_TEMPLATES,
} from './recommendations.types';

/**
 * Recommendations Service
 *
 * Deterministic, explainable recommendation engine.
 * No AI - uses pure heuristic-based scoring.
 *
 * Algorithm:
 * 1. Load user preferences (category, author, format affinities)
 * 2. Get candidate books from catalog
 * 3. Exclude already-read and negative-signal books
 * 4. Score each candidate using weighted formula
 * 5. Generate human-readable reasons
 * 6. Return top-N sorted by score
 *
 * Fallback: If user has insufficient data, return popular books.
 */
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly config: RecommendationConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferencesService: PreferencesService,
  ) {
    this.config = DEFAULT_RECOMMENDATION_CONFIG;
  }

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    query: RecommendationQuery = {},
  ): Promise<RecommendationResponse> {
    const limit = Math.min(query.limit || 10, this.config.maxResults);
    const includeDebug = query.debug || false;

    // Load user preferences
    const preferences = await this.preferencesService.getUserPreferences(userId);

    // Check if we have enough data for personalized recommendations
    if (!preferences.dataQuality.hasEnoughData ||
        preferences.dataQuality.confidence < this.config.minConfidenceForPersonalized) {
      this.logger.debug(`User ${userId} has insufficient data, using fallback`);
      return this.getFallbackRecommendations(limit, preferences.dataQuality.confidence);
    }

    // Get candidate books
    const { candidates, excluded } = await this.getCandidateBooks(
      userId,
      preferences,
      query,
    );

    if (candidates.length === 0) {
      this.logger.debug(`No candidates for user ${userId}, using fallback`);
      return this.getFallbackRecommendations(limit, preferences.dataQuality.confidence);
    }

    // Score and rank candidates
    const scored = candidates.map((book) =>
      this.scoreBook(book, preferences, includeDebug),
    );

    // Sort by score descending and take top N
    const sorted = scored
      .filter((r) => r.score >= this.config.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      items: sorted,
      meta: {
        confidence: preferences.dataQuality.confidence,
        fallbackUsed: false,
        candidatesConsidered: candidates.length,
        excluded,
        algorithmVersion: this.config.algorithmVersion,
      },
    };
  }

  /**
   * Get candidate books for recommendation
   *
   * Excludes:
   * - Already READ books
   * - Books matching negative category signals
   */
  private async getCandidateBooks(
    userId: string,
    preferences: UserPreferences,
    query: RecommendationQuery,
  ): Promise<{ candidates: RecommendedBook[]; excluded: number }> {
    // Get IDs of books already read
    const readBookIds = await this.prisma.userBook.findMany({
      where: { userId, status: 'READ' },
      select: { bookId: true },
    });
    const readIds = new Set(readBookIds.map((b) => b.bookId));

    // Get negative category IDs
    const negativeCategoryIds = new Set(
      preferences.negativeSignals.categories.map((c) => c.id),
    );

    // Build query filters
    const whereClause: any = {
      // Only active books
      // Optionally filter by format
      ...(query.format && {
        [`has${query.format.charAt(0).toUpperCase() + query.format.slice(1)}`]: true,
      }),
      // Optionally filter by category
      ...(query.categoryId && {
        categories: {
          some: { categoryId: query.categoryId },
        },
      }),
    };

    // Fetch candidate books
    const books = await this.prisma.book.findMany({
      where: whereClause,
      take: 200, // Limit candidates for performance
      orderBy: [
        { ratingsCount: 'desc' },
        { avgRating: 'desc' },
      ],
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

    // Filter and transform
    let excluded = 0;
    const candidates: RecommendedBook[] = [];

    for (const book of books) {
      // Exclude already read
      if (readIds.has(book.id)) {
        excluded++;
        continue;
      }

      // Exclude books primarily in negative categories
      const bookCategoryIds = book.categories.map((c) => c.categoryId);
      const negativeMatchCount = bookCategoryIds.filter((id) =>
        negativeCategoryIds.has(id),
      ).length;

      // Skip if majority of categories are negative
      if (negativeMatchCount > 0 && negativeMatchCount >= bookCategoryIds.length / 2) {
        excluded++;
        continue;
      }

      candidates.push({
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
      });
    }

    return { candidates, excluded };
  }

  /**
   * Score a single book based on user preferences
   *
   * Formula:
   * finalScore = categoryScore * 0.4 +
   *              authorScore * 0.3 +
   *              formatScore * 0.2 +
   *              popularityScore * 0.1 +
   *              offerBoost (if has offers)
   */
  scoreBook(
    book: RecommendedBook,
    preferences: UserPreferences,
    includeDebug = false,
  ): Recommendation {
    // Calculate component scores
    const categoryResult = this.calculateCategoryScore(book, preferences.categories);
    const authorResult = this.calculateAuthorScore(book, preferences.authors);
    const formatResult = this.calculateFormatScore(book, preferences.formats);
    const popularityScore = this.calculatePopularityScore(book);

    // Calculate weighted final score
    let finalScore =
      categoryResult.score * this.config.weights.category +
      authorResult.score * this.config.weights.author +
      formatResult.score * this.config.weights.format +
      popularityScore * this.config.weights.popularity;

    // Add offer boost
    if (book.hasOffers) {
      finalScore += this.config.offerBoost;
    }

    // Normalize to 0-1 range
    finalScore = Math.min(1, Math.max(0, finalScore));

    // Generate reasons
    const reasons = this.generateReasons(
      book,
      preferences,
      categoryResult,
      authorResult,
      formatResult,
      popularityScore,
    );

    const recommendation: Recommendation = {
      book,
      score: Math.round(finalScore * 100) / 100,
      reasons,
    };

    if (includeDebug) {
      recommendation.debug = {
        categoryScore: Math.round(categoryResult.score * 100) / 100,
        authorScore: Math.round(authorResult.score * 100) / 100,
        formatScore: Math.round(formatResult.score * 100) / 100,
        popularityScore: Math.round(popularityScore * 100) / 100,
        matchedCategories: categoryResult.matched,
        matchedAuthors: authorResult.matched,
        matchedFormat: formatResult.matched,
      };
    }

    return recommendation;
  }

  /**
   * Calculate category affinity score
   *
   * Returns the highest affinity score among book's categories.
   */
  private calculateCategoryScore(
    book: RecommendedBook,
    categoryAffinities: CategoryAffinity[],
  ): { score: number; matched: string[]; ratings: Map<string, number> } {
    const affinityMap = new Map(categoryAffinities.map((c) => [c.name, c]));
    const matched: string[] = [];
    const ratings = new Map<string, number>();
    let maxScore = 0;

    for (const category of book.categories) {
      const affinity = affinityMap.get(category);
      if (affinity) {
        matched.push(category);
        if (affinity.averageRating) {
          ratings.set(category, affinity.averageRating);
        }
        if (affinity.score > maxScore) {
          maxScore = affinity.score;
        }
      }
    }

    return { score: maxScore, matched, ratings };
  }

  /**
   * Calculate author affinity score
   *
   * Returns the highest affinity score among book's authors.
   */
  private calculateAuthorScore(
    book: RecommendedBook,
    authorAffinities: AuthorAffinity[],
  ): { score: number; matched: string[]; booksRead: Map<string, number> } {
    const affinityMap = new Map(authorAffinities.map((a) => [a.name, a]));
    const matched: string[] = [];
    const booksRead = new Map<string, number>();
    let maxScore = 0;

    for (const author of book.authors) {
      const affinity = affinityMap.get(author);
      if (affinity) {
        matched.push(author);
        booksRead.set(author, affinity.booksRead);
        if (affinity.score > maxScore) {
          maxScore = affinity.score;
        }
      }
    }

    return { score: maxScore, matched, booksRead };
  }

  /**
   * Calculate format preference score
   *
   * Checks if book is available in user's preferred format.
   */
  private calculateFormatScore(
    book: RecommendedBook,
    formatAffinities: FormatAffinity[],
  ): { score: number; matched?: string } {
    // Sort by score to get preferred format
    const sortedFormats = [...formatAffinities].sort((a, b) => b.score - a.score);

    for (const pref of sortedFormats) {
      if (pref.score > 0) {
        const hasFormat =
          (pref.format === 'paper' && book.formats.paper) ||
          (pref.format === 'ebook' && book.formats.ebook) ||
          (pref.format === 'audiobook' && book.formats.audiobook);

        if (hasFormat) {
          return { score: pref.score, matched: pref.format };
        }
      }
    }

    // No format match - check if any format available
    if (book.formats.paper || book.formats.ebook || book.formats.audiobook) {
      return { score: 0.3, matched: undefined }; // Partial score for availability
    }

    return { score: 0, matched: undefined };
  }

  /**
   * Calculate popularity score based on ratings
   *
   * Combines average rating and number of ratings.
   */
  private calculatePopularityScore(book: RecommendedBook): number {
    if (book.ratingsCount === 0) {
      return 0.3; // Neutral for unrated books
    }

    // Rating component (0-1 based on 1-5 scale)
    const ratingScore = (book.avgRating - 1) / 4;

    // Confidence based on number of ratings (log scale)
    const confidenceScore = Math.min(1, Math.log10(book.ratingsCount + 1) / 3);

    // Combine: higher rating matters more with more ratings
    return ratingScore * 0.7 + confidenceScore * 0.3;
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  private generateReasons(
    book: RecommendedBook,
    preferences: UserPreferences,
    categoryResult: { score: number; matched: string[]; ratings: Map<string, number> },
    authorResult: { score: number; matched: string[]; booksRead: Map<string, number> },
    formatResult: { score: number; matched?: string },
    popularityScore: number,
  ): string[] {
    const reasons: string[] = [];

    // Category reasons (highest scored category)
    if (categoryResult.matched.length > 0) {
      const topCategory = categoryResult.matched[0];
      const rating = categoryResult.ratings.get(topCategory);
      reasons.push(REASON_TEMPLATES.categoryMatch(topCategory, rating));
    }

    // Author reasons
    if (authorResult.matched.length > 0) {
      const topAuthor = authorResult.matched[0];
      const booksRead = authorResult.booksRead.get(topAuthor) || 0;
      reasons.push(REASON_TEMPLATES.authorMatch(topAuthor, booksRead));
    }

    // Format reason
    if (formatResult.matched) {
      reasons.push(REASON_TEMPLATES.formatMatch(formatResult.matched));
    }

    // Popularity reason (only for highly rated)
    if (book.avgRating >= 4.0 && book.ratingsCount >= 10) {
      reasons.push(REASON_TEMPLATES.popularBook(book.avgRating));
    }

    // Offers reason
    if (book.hasOffers && reasons.length < this.config.maxReasonsPerBook) {
      reasons.push(REASON_TEMPLATES.hasOffers());
    }

    // Limit reasons
    return reasons.slice(0, this.config.maxReasonsPerBook);
  }

  /**
   * Get fallback recommendations when user has insufficient data
   *
   * Returns popular and newest books.
   */
  private async getFallbackRecommendations(
    limit: number,
    confidence: number,
  ): Promise<RecommendationResponse> {
    // Get popular books
    const popularBooks = await this.prisma.book.findMany({
      take: limit,
      orderBy: [
        { ratingsCount: 'desc' },
        { avgRating: 'desc' },
      ],
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

    const items: Recommendation[] = popularBooks.map((book) => ({
      book: {
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
      },
      score: this.calculatePopularityScore({
        avgRating: Number(book.avgRating),
        ratingsCount: book.ratingsCount,
      } as RecommendedBook),
      reasons: [
        REASON_TEMPLATES.popularBook(Number(book.avgRating)),
        'Popular among readers',
      ],
    }));

    return {
      items,
      meta: {
        confidence,
        fallbackUsed: true,
        candidatesConsidered: popularBooks.length,
        excluded: 0,
        algorithmVersion: this.config.algorithmVersion,
      },
    };
  }
}
