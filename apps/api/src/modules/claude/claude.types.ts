/**
 * Claude API Types
 *
 * Type definitions for Claude API integration.
 * These types support structured context and streaming responses.
 */

/**
 * Message role in conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * A single message in the conversation history
 */
export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

/**
 * User context for Claude - deterministic, reproducible data
 */
export interface UserContext {
  userId: string;
  userName?: string;
  preferredCategories: string[];
  preferredFormats: ('paper' | 'ebook' | 'audiobook')[];
  readBooksCount: number;
  averageRating?: number;
  recentlyViewedBooks: BookReference[];
  recentlyRatedBooks: RatedBookReference[];
  recentPurchases: PurchaseReference[];
}

/**
 * Reference to a book in the catalog
 */
export interface BookReference {
  id: string;
  isbn?: string;
  title: string;
  authors: string[];
  categories: string[];
}

/**
 * Book with user's rating
 */
export interface RatedBookReference extends BookReference {
  rating: number;
  status: 'read' | 'reading' | 'want_to_read';
}

/**
 * User purchase reference
 */
export interface PurchaseReference {
  bookId?: string;
  bookTitle?: string;
  format: string;
  purchasedAt: Date;
}

/**
 * Catalog context - available books for recommendations
 */
export interface CatalogContext {
  popularBooks: BookReference[];
  newestBooks: BookReference[];
  categoryBooks: Map<string, BookReference[]>;
}

/**
 * Full context for Claude API call
 */
export interface ClaudeContext {
  user: UserContext;
  conversationHistory: ConversationMessage[];
  currentMessage: string;
  catalog?: CatalogContext;
}

/**
 * Streaming chunk from Claude
 */
export interface StreamChunk {
  type: 'text' | 'metadata' | 'done' | 'error';
  content?: string;
  metadata?: {
    mentionedBookIds?: string[];
    recommendationIds?: string[];
    tokensUsed?: number;
  };
  error?: string;
}

/**
 * Complete response from Claude (non-streaming)
 */
export interface ClaudeResponse {
  content: string;
  tokensUsed: number;
  mentionedBookIds: string[];
  stopReason: string;
}

/**
 * Configuration for Claude API calls
 */
export interface ClaudeConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}
