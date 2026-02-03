/**
 * Recommendation Types
 *
 * Types for the deterministic recommendation engine.
 * No AI - pure heuristic-based scoring.
 */

/**
 * Book data for recommendations
 */
export interface RecommendedBook {
  id: string;
  isbn?: string;
  title: string;
  coverUrl?: string;
  description?: string;
  authors: string[];
  categories: string[];
  formats: {
    paper: boolean;
    ebook: boolean;
    audiobook: boolean;
  };
  avgRating: number;
  ratingsCount: number;
  hasOffers: boolean;
}

/**
 * Single recommendation with score and reasons
 */
export interface Recommendation {
  book: RecommendedBook;
  score: number;
  reasons: string[];
  debug?: RecommendationDebug;
}

/**
 * Debug info for score calculation
 */
export interface RecommendationDebug {
  categoryScore: number;
  authorScore: number;
  formatScore: number;
  popularityScore: number;
  matchedCategories: string[];
  matchedAuthors: string[];
  matchedFormat?: string;
}

/**
 * Recommendation response
 */
export interface RecommendationResponse {
  items: Recommendation[];
  meta: {
    /** Confidence in recommendations (from preferences) */
    confidence: number;
    /** True if fallback to popular books was used */
    fallbackUsed: boolean;
    /** Total candidates considered */
    candidatesConsidered: number;
    /** Books excluded (already read, negative signals) */
    excluded: number;
    /** Algorithm version for debugging */
    algorithmVersion: string;
  };
}

/**
 * Query parameters for recommendations
 */
export interface RecommendationQuery {
  /** Maximum number of recommendations */
  limit?: number;
  /** Include debug info in response */
  debug?: boolean;
  /** Filter by format */
  format?: 'paper' | 'ebook' | 'audiobook';
  /** Filter by category ID */
  categoryId?: string;
}

/**
 * Scoring weights configuration
 *
 * All weights must sum to 1.0 for normalized final scores.
 * These can be adjusted to tune recommendation quality.
 */
export interface ScoringWeights {
  /** Weight for category affinity match */
  category: number;
  /** Weight for author affinity match */
  author: number;
  /** Weight for format preference match */
  format: number;
  /** Weight for global popularity/rating */
  popularity: number;
}

/**
 * Default scoring weights
 *
 * Category is weighted highest because genre preference
 * is the strongest indicator of what users want to read.
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  category: 0.4,   // 40% - genre/category match
  author: 0.3,     // 30% - author preference
  format: 0.2,     // 20% - format availability
  popularity: 0.1, // 10% - global popularity boost
};

/**
 * Recommendation engine configuration
 */
export interface RecommendationConfig {
  /** Scoring weights */
  weights: ScoringWeights;

  /** Minimum score to include in results (0-1) */
  minScore: number;

  /** Maximum recommendations to return */
  maxResults: number;

  /** Minimum preference confidence to use personalized recs */
  minConfidenceForPersonalized: number;

  /** Boost for books with BUYBOX offers */
  offerBoost: number;

  /** Maximum reasons to show per book */
  maxReasonsPerBook: number;

  /** Algorithm version identifier */
  algorithmVersion: string;
}

/**
 * Default configuration
 */
export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  weights: DEFAULT_SCORING_WEIGHTS,
  minScore: 0.1,
  maxResults: 20,
  minConfidenceForPersonalized: 0.2,
  offerBoost: 0.05,
  maxReasonsPerBook: 4,
  algorithmVersion: '1.0.0',
};

/**
 * Reason templates for explainability
 */
export const REASON_TEMPLATES = {
  categoryMatch: (category: string, rating?: number) =>
    rating && rating >= 4
      ? `You highly rate ${category} books`
      : `You enjoy ${category} books`,

  authorMatch: (author: string, booksRead: number) =>
    booksRead > 2
      ? `You frequently read ${author}`
      : `You've enjoyed books by ${author}`,

  formatMatch: (format: string) =>
    `Available in your preferred format (${format})`,

  popularBook: (rating: number) =>
    `Highly rated by readers (${rating.toFixed(1)}/5)`,

  hasOffers: () => `Available now from multiple stores`,

  sameSeriesAuthor: (author: string) =>
    `More from ${author}, an author you like`,

  similarToRated: (bookTitle: string) =>
    `Similar to "${bookTitle}" which you rated highly`,
};
