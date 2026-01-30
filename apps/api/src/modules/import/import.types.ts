/**
 * Book Import Types
 *
 * Defines the structure for importing books from external product feeds.
 * Supports JSON and CSV formats.
 */

/**
 * Raw book data from product feed
 */
export interface BookImportData {
  /** ISBN-13 (primary identifier) */
  isbn?: string;
  /** EAN (European Article Number) */
  ean?: string;
  /** Book title */
  title: string;
  /** Original title (if translated) */
  originalTitle?: string;
  /** Book description/synopsis */
  description?: string;
  /** Cover image URL */
  coverUrl?: string;
  /** Publication date (ISO format or year) */
  publishedAt?: string;
  /** Publisher name */
  publisher?: string;
  /** Number of pages */
  pageCount?: number;
  /** Language code (default: pl) */
  language?: string;
  /** Author names (comma-separated or array) */
  authors?: string | string[];
  /** Category names or slugs (comma-separated or array) */
  categories?: string | string[];
  /** Available formats */
  formats?: {
    paper?: boolean;
    ebook?: boolean;
    audiobook?: boolean;
  };
}

/**
 * Result of importing a single book
 */
export interface BookImportResult {
  isbn?: string;
  title: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  bookId?: string;
  error?: string;
}

/**
 * Result of a batch import
 */
export interface BatchImportResult {
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: BookImportResult[];
  duration: number;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Update existing books (default: false) */
  updateExisting?: boolean;
  /** Skip books without ISBN (default: false) */
  requireIsbn?: boolean;
  /** Create missing categories (default: true) */
  createCategories?: boolean;
  /** Create missing authors (default: true) */
  createAuthors?: boolean;
  /** Batch size for processing (default: 100) */
  batchSize?: number;
}
