/**
 * Recommendation Explanation Types
 *
 * Types for AI-powered explanation layer.
 * Claude explains recommendations but does NOT generate them.
 */

import { RecommendedBook, RecommendationDebug } from './recommendations.types';
import {
  CategoryAffinity,
  AuthorAffinity,
  FormatAffinity,
} from '../preferences/preferences.types';

/**
 * Request to explain why a book is recommended
 */
export interface ExplainRequest {
  /** Book ID to explain */
  bookId: string;
  /** Optional user question for context */
  context?: string;
}

/**
 * Response with AI-generated explanation
 */
export interface ExplainResponse {
  /** Book ID that was explained */
  bookId: string;
  /** AI-generated explanation in Polish */
  explanation: string;
  /** Algorithmic reasons (from deterministic engine) */
  reasons: string[];
  /** Confidence score from preference data */
  confidence: number;
  /** Alternative books to try (from catalog only) */
  alternatives?: AlternativeBook[];
}

/**
 * Alternative book suggestion
 */
export interface AlternativeBook {
  id: string;
  title: string;
  authors: string[];
  /** Why this is an alternative */
  reason: string;
}

/**
 * Request to compare multiple books
 */
export interface CompareRequest {
  /** Book IDs to compare (2-5 books) */
  bookIds: string[];
  /** User's question about the comparison */
  question?: string;
}

/**
 * Response with comparison
 */
export interface CompareResponse {
  /** Books being compared */
  books: ComparedBook[];
  /** AI-generated comparison in Polish */
  comparison: string;
  /** Which book fits best based on preferences */
  bestFitId?: string;
  /** Why the best fit was chosen */
  bestFitReason?: string;
}

/**
 * Book in comparison with its score
 */
export interface ComparedBook {
  id: string;
  title: string;
  authors: string[];
  /** Recommendation score (0-1) */
  score: number;
  /** Matching factors */
  matchedCategories: string[];
  matchedAuthors: string[];
}

/**
 * Context payload for Claude
 *
 * This is the structured data we send to Claude
 * to ensure it can only work with catalog data.
 */
export interface ExplainContext {
  /** The book being explained */
  book: RecommendedBook;
  /** Debug info from scoring (if available) */
  scoring?: RecommendationDebug;
  /** User's category preferences */
  categoryAffinities: CategoryAffinity[];
  /** User's author preferences */
  authorAffinities: AuthorAffinity[];
  /** User's format preferences */
  formatAffinities: FormatAffinity[];
  /** Categories to avoid */
  negativeCategories: string[];
  /** Authors to avoid */
  negativeAuthors: string[];
  /** User's reading stats */
  readingStats: {
    totalBooks: number;
    readCount: number;
    averageRating?: number;
  };
  /** Other candidate books (for "Try also" suggestions) */
  candidateBooks: CandidateBookSummary[];
  /** User's question (if any) */
  userQuestion?: string;
}

/**
 * Summary of a candidate book for alternatives
 */
export interface CandidateBookSummary {
  id: string;
  title: string;
  authors: string[];
  categories: string[];
  score: number;
}

/**
 * Context for comparing multiple books
 */
export interface CompareContext {
  /** Books being compared */
  books: Array<{
    book: RecommendedBook;
    scoring?: RecommendationDebug;
    score: number;
  }>;
  /** User preferences summary */
  preferences: {
    topCategories: string[];
    topAuthors: string[];
    preferredFormat?: string;
  };
  /** User's comparison question */
  userQuestion?: string;
}

/**
 * Guardrail result
 */
export interface GuardrailResult {
  /** Whether the request passed guardrails */
  passed: boolean;
  /** Error message if failed */
  error?: string;
  /** Suggested response if request is out of scope */
  suggestedResponse?: string;
}

/**
 * Allowed book IDs list for guardrails
 */
export interface AllowedBooksContext {
  /** Set of allowed book IDs */
  allowedIds: Set<string>;
  /** Map of ID to title for reference */
  idToTitle: Map<string, string>;
}
