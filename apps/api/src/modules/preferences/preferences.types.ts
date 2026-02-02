/**
 * Preference Signal Types
 *
 * Internal types for user preference aggregation.
 * Used by recommendation engine and Claude context builder.
 *
 * All affinity scores are normalized to 0..1 range.
 * Higher = stronger preference.
 */

/**
 * Single affinity score with metadata
 */
export interface AffinityScore {
  /** Unique identifier (category ID, author ID, format name) */
  id: string;

  /** Display name */
  name: string;

  /** Normalized score 0..1 (higher = stronger preference) */
  score: number;

  /** Number of data points used to calculate score */
  sampleCount: number;

  /** Average rating for items in this affinity (if applicable) */
  averageRating?: number;

  /** Debug info about score calculation */
  debug?: {
    rawScore: number;
    recencyBonus: number;
    ratingWeight: number;
  };
}

/**
 * Category affinity with hierarchy info
 */
export interface CategoryAffinity extends AffinityScore {
  /** Parent category ID (if subcategory) */
  parentId?: string;

  /** Slug for URL/display */
  slug?: string;
}

/**
 * Author affinity
 */
export interface AuthorAffinity extends AffinityScore {
  /** Number of books read by this author */
  booksRead: number;
}

/**
 * Format affinity (paper, ebook, audiobook)
 */
export interface FormatAffinity {
  format: 'paper' | 'ebook' | 'audiobook';
  score: number;
  fromBookshelf: number;
  fromPurchases: number;
  total: number;
}

/**
 * Reading statistics
 */
export interface ReadingStats {
  /** Total books in bookshelf */
  totalBooks: number;

  /** Books by status */
  byStatus: {
    wantToRead: number;
    reading: number;
    read: number;
  };

  /** Rating statistics */
  ratings: {
    count: number;
    average: number;
    distribution: Record<number, number>; // { 1: 2, 2: 5, 3: 10, ... }
  };

  /** Recent activity (last 30 days) */
  recentActivity: {
    booksAdded: number;
    booksRated: number;
    booksFinished: number;
  };
}

/**
 * Complete user preferences snapshot
 */
export interface UserPreferences {
  /** User ID */
  userId: string;

  /** When preferences were calculated */
  calculatedAt: Date;

  /** Category affinities (sorted by score descending) */
  categories: CategoryAffinity[];

  /** Author affinities (sorted by score descending) */
  authors: AuthorAffinity[];

  /** Format affinities */
  formats: FormatAffinity[];

  /** Reading statistics */
  stats: ReadingStats;

  /** Negative signals (low-rated categories to avoid) */
  negativeSignals: {
    categories: CategoryAffinity[];
    authors: AuthorAffinity[];
  };

  /** Data freshness indicators */
  dataQuality: {
    /** Has enough data for reliable preferences */
    hasEnoughData: boolean;

    /** Last rating date */
    lastRatingAt?: Date;

    /** Last status change date */
    lastActivityAt?: Date;

    /** Confidence level 0..1 */
    confidence: number;
  };
}

/**
 * Configuration for preference calculation
 */
export interface PreferenceConfig {
  /** How much recent ratings are weighted vs older ones */
  recencyDecayDays: number;

  /** Minimum rating to consider positive (default: 3) */
  positiveRatingThreshold: number;

  /** Maximum rating to consider negative (default: 2) */
  negativeRatingThreshold: number;

  /** Days to consider for "recent" activity */
  recentActivityDays: number;

  /** Minimum samples for reliable affinity */
  minSamplesForReliability: number;

  /** Weight multipliers for status */
  statusWeights: {
    read: number;
    reading: number;
    wantToRead: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_PREFERENCE_CONFIG: PreferenceConfig = {
  recencyDecayDays: 180, // 6 months half-life
  positiveRatingThreshold: 3,
  negativeRatingThreshold: 2,
  recentActivityDays: 30,
  minSamplesForReliability: 3,
  statusWeights: {
    read: 1.0,
    reading: 0.6,
    wantToRead: 0.3,
  },
};
