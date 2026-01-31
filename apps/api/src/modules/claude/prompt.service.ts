import { Injectable } from '@nestjs/common';
import {
  UserContext,
  BookReference,
  RatedBookReference,
  ConversationMessage,
} from './claude.types';

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
}
