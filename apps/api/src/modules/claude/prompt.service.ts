import { Injectable } from '@nestjs/common';
import {
  UserContext,
  BookReference,
  RatedBookReference,
  ConversationMessage,
} from './claude.types';
import {
  ExplainContext,
  CompareContext,
  CandidateBookSummary,
} from '../recommendations/recommendations-explain.types';

/**
 * Prompt Service
 *
 * Manages all prompts for Claude API.
 * All prompts are centralized here - no hardcoded prompts in controllers.
 *
 * Design principles:
 * - Prompts are deterministic and reproducible
 * - Context is structured, not raw text
 * - Claude is an assistant, catalog is source of truth
 * - No hallucinated books allowed
 */
@Injectable()
export class PromptService {
  /**
   * Get the system prompt for book assistant
   */
  getSystemPrompt(): string {
    return `Jesteś pomocnym asystentem książkowym dla polskiej aplikacji "Szukaj Książek".

TWOJA ROLA:
- Pomagasz użytkownikom odkrywać i wybierać książki
- Odpowiadasz na pytania o książki
- Dajesz spersonalizowane rekomendacje oparte na preferencjach użytkownika
- Zawsze mówisz po polsku

WAŻNE ZASADY:
1. NIGDY nie wymyślaj książek, które nie istnieją w katalogu
2. Gdy polecasz książkę, używaj TYLKO książek z dostarczonego kontekstu
3. Jeśli nie znasz książki z katalogu, powiedz szczerze że jej nie masz
4. Gdy użytkownik pyta o książkę spoza katalogu, powiedz że jej nie masz w bazie
5. Rekomendacje muszą być oparte na faktycznych danych: oceny, kategorie, formaty

FORMAT ODPOWIEDZI:
- Odpowiadaj zwięźle i konkretnie
- Gdy polecasz książki, wymień tytuł i autora
- Wyjaśniaj DLACZEGO polecasz daną książkę (np. "bo lubisz kryminały", "bo wysoko oceniłeś podobne książki")
- Używaj formatu listy dla wielu rekomendacji

KONTEKST UŻYTKOWNIKA:
Otrzymasz informacje o:
- Preferencjach użytkownika (kategorie, formaty)
- Przeczytanych i ocenionych książkach
- Ostatnio przeglądanych pozycjach
- Zakupach

Wykorzystuj te dane do personalizacji odpowiedzi.`;
  }

  /**
   * Build user context section for prompt
   */
  buildUserContextSection(context: UserContext): string {
    const sections: string[] = [];

    // Basic info
    if (context.userName) {
      sections.push(`Użytkownik: ${context.userName}`);
    }

    // Preferred categories
    if (context.preferredCategories.length > 0) {
      sections.push(`Ulubione kategorie: ${context.preferredCategories.join(', ')}`);
    }

    // Preferred formats
    if (context.preferredFormats.length > 0) {
      const formatNames = context.preferredFormats.map((f) => {
        switch (f) {
          case 'paper':
            return 'papierowe';
          case 'ebook':
            return 'e-booki';
          case 'audiobook':
            return 'audiobooki';
          default:
            return f;
        }
      });
      sections.push(`Preferowane formaty: ${formatNames.join(', ')}`);
    }

    // Reading stats
    if (context.readBooksCount > 0) {
      sections.push(`Przeczytane książki: ${context.readBooksCount}`);
      if (context.averageRating) {
        sections.push(`Średnia ocena: ${context.averageRating.toFixed(1)}/5`);
      }
    }

    // Recently rated books
    if (context.recentlyRatedBooks.length > 0) {
      const ratedList = context.recentlyRatedBooks
        .slice(0, 5)
        .map((b) => `- "${b.title}" (${b.authors.join(', ')}) - ocena: ${b.rating}/5`)
        .join('\n');
      sections.push(`Ostatnio ocenione książki:\n${ratedList}`);
    }

    // Recently viewed
    if (context.recentlyViewedBooks.length > 0) {
      const viewedList = context.recentlyViewedBooks
        .slice(0, 5)
        .map((b) => `- "${b.title}" (${b.authors.join(', ')})`)
        .join('\n');
      sections.push(`Ostatnio przeglądane:\n${viewedList}`);
    }

    // Recent purchases
    if (context.recentPurchases.length > 0) {
      const purchaseList = context.recentPurchases
        .slice(0, 3)
        .map((p) => `- "${p.bookTitle || 'Nieznana książka'}" (${p.format})`)
        .join('\n');
      sections.push(`Ostatnie zakupy:\n${purchaseList}`);
    }

    if (sections.length === 0) {
      return 'Nowy użytkownik - brak historii.';
    }

    return sections.join('\n\n');
  }

  /**
   * Build available books section for recommendations
   */
  buildAvailableBooksSection(books: BookReference[]): string {
    if (books.length === 0) {
      return 'Brak dostępnych książek do polecenia.';
    }

    const bookList = books
      .slice(0, 20) // Limit to avoid token overflow
      .map((b) => {
        const authors = b.authors.join(', ');
        const categories = b.categories.join(', ');
        return `- [ID:${b.id}] "${b.title}" - ${authors} (${categories})`;
      })
      .join('\n');

    return `Dostępne książki do polecenia:\n${bookList}`;
  }

  /**
   * Build conversation history for context
   */
  buildConversationHistory(messages: ConversationMessage[]): string {
    if (messages.length === 0) {
      return '';
    }

    // Take last 10 messages to avoid token overflow
    const recentMessages = messages.slice(-10);

    return recentMessages
      .map((m) => {
        const role = m.role === 'user' ? 'Użytkownik' : 'Asystent';
        return `${role}: ${m.content}`;
      })
      .join('\n\n');
  }

  /**
   * Build complete prompt for Claude
   */
  buildCompletePrompt(params: {
    userContext: UserContext;
    conversationHistory: ConversationMessage[];
    currentMessage: string;
    availableBooks?: BookReference[];
  }): string {
    const sections: string[] = [];

    // User context
    sections.push('=== KONTEKST UŻYTKOWNIKA ===');
    sections.push(this.buildUserContextSection(params.userContext));

    // Available books for recommendations
    if (params.availableBooks && params.availableBooks.length > 0) {
      sections.push('\n=== KSIĄŻKI DO POLECENIA ===');
      sections.push(this.buildAvailableBooksSection(params.availableBooks));
    }

    // Conversation history
    if (params.conversationHistory.length > 0) {
      sections.push('\n=== HISTORIA ROZMOWY ===');
      sections.push(this.buildConversationHistory(params.conversationHistory));
    }

    // Current message
    sections.push('\n=== AKTUALNA WIADOMOŚĆ ===');
    sections.push(`Użytkownik: ${params.currentMessage}`);

    return sections.join('\n');
  }

  /**
   * Get prompt for generating conversation title
   */
  getTitleGenerationPrompt(firstMessage: string): string {
    return `Na podstawie pierwszej wiadomości użytkownika, wygeneruj krótki tytuł rozmowy (max 50 znaków).
Tytuł powinien odzwierciedlać temat rozmowy.
Odpowiedz TYLKO tytułem, bez dodatkowego tekstu.

Wiadomość: "${firstMessage}"`;
  }

  /**
   * Get prompt for explaining a recommendation
   */
  getRecommendationExplanationPrompt(
    book: BookReference,
    userContext: UserContext,
    reason: string,
  ): string {
    return `Wyjaśnij użytkownikowi dlaczego polecamy mu tę książkę.

Książka: "${book.title}" - ${book.authors.join(', ')}
Kategorie: ${book.categories.join(', ')}

Powód algorytmiczny: ${reason}

Kontekst użytkownika:
${this.buildUserContextSection(userContext)}

Napisz krótkie, przyjazne wyjaśnienie (2-3 zdania) dlaczego ta książka może mu się spodobać.
Odwołuj się do jego preferencji i historii.`;
  }

  /**
   * Get system prompt for recommendation explanations
   *
   * This prompt enforces guardrails: Claude can only discuss
   * books from the provided catalog list.
   */
  getExplainSystemPrompt(): string {
    return `Jesteś asystentem książkowym dla polskiej aplikacji "Szukaj Książek".

TWOJA ROLA:
- Wyjaśniasz użytkownikom DLACZEGO polecamy im konkretne książki
- Odpowiadasz na pytania typu "dlaczego to?" i "co jeszcze?"
- Możesz proponować alternatywy, ALE TYLKO z dostarczonej listy książek

WAŻNE ZASADY (BEZWZGLĘDNIE PRZESTRZEGAJ):
1. NIGDY nie wymyślaj książek - używaj TYLKO ID i tytułów z listy DOZWOLONE_KSIĄŻKI
2. Jeśli użytkownik pyta o książkę spoza listy, odpowiedz:
   "Tej książki nie mam w aktualnych rekomendacjach. Użyj wyszukiwarki, aby ją znaleźć w katalogu."
3. Gdy proponujesz alternatywy, ZAWSZE używaj formatu: [ID:uuid] "Tytuł"
4. Nie oceniaj książek, których nie ma w kontekście

FORMAT ODPOWIEDZI:
- Odpowiadaj PO POLSKU
- Używaj maksymalnie 2-4 punktów z powodami
- Dodaj 1 krótkie zdanie podsumowujące
- Jeśli podajesz alternatywy, wymień max 2-3 książki z listy DOZWOLONE_KSIĄŻKI

STRUKTURA ODPOWIEDZI:
1. Główne powody (punktory)
2. Krótkie podsumowanie
3. (Opcjonalnie) "Sprawdź też:" z 2-3 alternatywami`;
  }

  /**
   * Build full explanation prompt with context
   */
  buildExplainPrompt(context: ExplainContext): string {
    const sections: string[] = [];

    // Book being explained
    sections.push('=== WYJAŚNIANA KSIĄŻKA ===');
    sections.push(this.formatBookDetails(context.book));

    // Scoring components (if available)
    if (context.scoring) {
      sections.push('\n=== WYNIK ALGORYTMU ===');
      sections.push(this.formatScoringDetails(context.scoring));
    }

    // User preferences
    sections.push('\n=== PREFERENCJE UŻYTKOWNIKA ===');
    sections.push(this.formatPreferences(context));

    // Negative signals
    if (context.negativeCategories.length > 0 || context.negativeAuthors.length > 0) {
      sections.push('\n=== SYGNAŁY NEGATYWNE ===');
      if (context.negativeCategories.length > 0) {
        sections.push(`Unikane kategorie: ${context.negativeCategories.join(', ')}`);
      }
      if (context.negativeAuthors.length > 0) {
        sections.push(`Unikani autorzy: ${context.negativeAuthors.join(', ')}`);
      }
    }

    // Allowed books for alternatives
    sections.push('\n=== DOZWOLONE_KSIĄŻKI (tylko te możesz polecić) ===');
    sections.push(this.formatAllowedBooks(context.candidateBooks));

    // User question
    if (context.userQuestion) {
      sections.push('\n=== PYTANIE UŻYTKOWNIKA ===');
      sections.push(context.userQuestion);
    } else {
      sections.push('\n=== ZADANIE ===');
      sections.push('Wyjaśnij dlaczego ta książka jest polecana dla tego użytkownika.');
    }

    return sections.join('\n');
  }

  /**
   * Get system prompt for book comparison
   */
  getCompareSystemPrompt(): string {
    return `Jesteś asystentem książkowym dla polskiej aplikacji "Szukaj Książek".

TWOJA ROLA:
- Porównujesz książki i pomagasz użytkownikowi wybrać najlepszą dla niego
- Opierasz się na preferencjach użytkownika i wynikach algorytmu

WAŻNE ZASADY:
1. Porównuj TYLKO książki z dostarczonej listy
2. Odpowiadaj PO POLSKU
3. Bądź obiektywny - wskaż mocne i słabe strony każdej opcji
4. Podaj jasną rekomendację na końcu

FORMAT ODPOWIEDZI:
1. Krótkie porównanie każdej książki (2-3 punkty na książkę)
2. Która pasuje najlepiej i dlaczego (1-2 zdania)`;
  }

  /**
   * Build comparison prompt
   */
  buildComparePrompt(context: CompareContext): string {
    const sections: string[] = [];

    // Books to compare
    sections.push('=== KSIĄŻKI DO PORÓWNANIA ===');
    for (const item of context.books) {
      sections.push(`\n[ID:${item.book.id}] "${item.book.title}"`);
      sections.push(`  Autorzy: ${item.book.authors.join(', ')}`);
      sections.push(`  Kategorie: ${item.book.categories.join(', ')}`);
      sections.push(`  Wynik dopasowania: ${(item.score * 100).toFixed(0)}%`);
      if (item.scoring) {
        sections.push(`  - Dopasowanie kategorii: ${(item.scoring.categoryScore * 100).toFixed(0)}%`);
        sections.push(`  - Dopasowanie autora: ${(item.scoring.authorScore * 100).toFixed(0)}%`);
        sections.push(`  - Dopasowanie formatu: ${(item.scoring.formatScore * 100).toFixed(0)}%`);
      }
    }

    // User preferences summary
    sections.push('\n=== PREFERENCJE UŻYTKOWNIKA ===');
    if (context.preferences.topCategories.length > 0) {
      sections.push(`Ulubione kategorie: ${context.preferences.topCategories.join(', ')}`);
    }
    if (context.preferences.topAuthors.length > 0) {
      sections.push(`Ulubieni autorzy: ${context.preferences.topAuthors.join(', ')}`);
    }
    if (context.preferences.preferredFormat) {
      sections.push(`Preferowany format: ${context.preferences.preferredFormat}`);
    }

    // User question
    if (context.userQuestion) {
      sections.push('\n=== PYTANIE UŻYTKOWNIKA ===');
      sections.push(context.userQuestion);
    } else {
      sections.push('\n=== ZADANIE ===');
      sections.push('Porównaj te książki i wskaż, która najlepiej pasuje do preferencji użytkownika.');
    }

    return sections.join('\n');
  }

  /**
   * Format book details for prompt
   */
  private formatBookDetails(book: {
    id: string;
    title: string;
    authors: string[];
    categories: string[];
    description?: string;
    avgRating: number;
    ratingsCount: number;
    formats: { paper: boolean; ebook: boolean; audiobook: boolean };
  }): string {
    const lines: string[] = [];
    lines.push(`[ID:${book.id}] "${book.title}"`);
    lines.push(`Autorzy: ${book.authors.join(', ')}`);
    lines.push(`Kategorie: ${book.categories.join(', ')}`);
    if (book.description) {
      const shortDesc = book.description.length > 200
        ? book.description.substring(0, 200) + '...'
        : book.description;
      lines.push(`Opis: ${shortDesc}`);
    }
    lines.push(`Ocena: ${book.avgRating.toFixed(1)}/5 (${book.ratingsCount} ocen)`);

    const formats: string[] = [];
    if (book.formats.paper) formats.push('papier');
    if (book.formats.ebook) formats.push('ebook');
    if (book.formats.audiobook) formats.push('audiobook');
    lines.push(`Dostępne formaty: ${formats.join(', ')}`);

    return lines.join('\n');
  }

  /**
   * Format scoring details for prompt
   */
  private formatScoringDetails(scoring: {
    categoryScore: number;
    authorScore: number;
    formatScore: number;
    popularityScore: number;
    matchedCategories: string[];
    matchedAuthors: string[];
    matchedFormat?: string;
  }): string {
    const lines: string[] = [];
    lines.push(`Dopasowanie kategorii: ${(scoring.categoryScore * 100).toFixed(0)}%`);
    if (scoring.matchedCategories.length > 0) {
      lines.push(`  Pasujące: ${scoring.matchedCategories.join(', ')}`);
    }
    lines.push(`Dopasowanie autora: ${(scoring.authorScore * 100).toFixed(0)}%`);
    if (scoring.matchedAuthors.length > 0) {
      lines.push(`  Pasujący: ${scoring.matchedAuthors.join(', ')}`);
    }
    lines.push(`Dopasowanie formatu: ${(scoring.formatScore * 100).toFixed(0)}%`);
    if (scoring.matchedFormat) {
      lines.push(`  Preferowany: ${scoring.matchedFormat}`);
    }
    lines.push(`Popularność: ${(scoring.popularityScore * 100).toFixed(0)}%`);
    return lines.join('\n');
  }

  /**
   * Format user preferences for prompt
   */
  private formatPreferences(context: ExplainContext): string {
    const lines: string[] = [];

    // Category affinities (top 5)
    if (context.categoryAffinities.length > 0) {
      const topCats = context.categoryAffinities
        .slice(0, 5)
        .map((c) => `${c.name} (${(c.score * 100).toFixed(0)}%)`)
        .join(', ');
      lines.push(`Ulubione kategorie: ${topCats}`);
    }

    // Author affinities (top 3)
    if (context.authorAffinities.length > 0) {
      const topAuthors = context.authorAffinities
        .slice(0, 3)
        .map((a) => `${a.name} (${a.booksRead} książek)`)
        .join(', ');
      lines.push(`Ulubieni autorzy: ${topAuthors}`);
    }

    // Format preferences
    if (context.formatAffinities.length > 0) {
      const topFormat = context.formatAffinities
        .sort((a, b) => b.score - a.score)[0];
      const formatName = topFormat.format === 'paper' ? 'papier' :
        topFormat.format === 'ebook' ? 'ebook' : 'audiobook';
      lines.push(`Preferowany format: ${formatName}`);
    }

    // Reading stats
    lines.push(`Przeczytane książki: ${context.readingStats.readCount}`);
    if (context.readingStats.averageRating) {
      lines.push(`Średnia ocena: ${context.readingStats.averageRating.toFixed(1)}/5`);
    }

    return lines.join('\n');
  }

  /**
   * Format allowed books list for guardrails
   */
  private formatAllowedBooks(books: CandidateBookSummary[]): string {
    if (books.length === 0) {
      return 'Brak dodatkowych książek do polecenia.';
    }

    // Limit to top 10 for prompt size
    return books
      .slice(0, 10)
      .map((b) => `[ID:${b.id}] "${b.title}" - ${b.authors.join(', ')} (${b.categories.slice(0, 2).join(', ')})`)
      .join('\n');
  }
}
