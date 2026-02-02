/**
 * Purchase Types
 *
 * Data contracts for BUYBOX Transactions API integration.
 * These types define the interface between our system and the BUYBOX API.
 *
 * Official BUYBOX Transactions API:
 * - Base URL: https://api.buybox.click
 * - Endpoint: GET /api/v1/spaces/{spaceId}/transactions
 * - See /docs/BUYBOX_TRANSACTIONS_API.md for full documentation
 */

/**
 * Purchase format from BUYBOX
 */
export type PurchaseFormat = 'paper' | 'ebook' | 'audiobook';

/**
 * Transaction status from BUYBOX API
 */
export type BuyboxTransactionStatus = 'new' | 'accept' | 'reject';

/**
 * Raw transaction from BUYBOX Transactions API
 * Matches the actual API response structure
 */
export interface BuyboxTransactionRaw {
  /** Transaction ID */
  transId: string;

  /** Transaction amount (purchase price) */
  amount: number;

  /** Transaction date (ISO format or YYYY-MM-DD) */
  date: string;

  /** Space ID (publisher account) */
  spaceId: string;

  /** Campaign ID (store/retailer identifier) */
  campId: string;

  /** Transaction status */
  status: BuyboxTransactionStatus;

  /** Publisher commission amount */
  publisherCommissionAmount: number;

  /**
   * Affiliate tracking parameters
   * These can contain product identifiers (ISBN, EAN) passed during click
   * - abpar1: Often used for ISBN/EAN
   * - abpar2: Often used for product category or format
   * - abpar3: Additional tracking data
   */
  abpar1?: string;
  abpar2?: string;
  abpar3?: string;
}

/**
 * Raw response from BUYBOX Transactions API
 */
export interface BuyboxTransactionsApiResponse {
  /** Array of transactions */
  transactions?: BuyboxTransactionRaw[];

  /** Alternative: transactions might be at root level */
  data?: BuyboxTransactionRaw[];

  /** Total page count for pagination */
  count?: number;

  /** Error message if request failed */
  error?: string;
  message?: string;
}

/**
 * Normalized purchase data (internal format)
 * Converted from BuyboxTransactionRaw
 */
export interface BuyboxPurchaseData {
  /** BUYBOX transaction ID */
  orderId: string;

  /** ISBN or EAN of the purchased book (from abpar1 or abpar2) */
  productIdentifier: string;

  /** Type of identifier */
  identifierType: 'isbn' | 'ean' | 'internal';

  /** Store/retailer name (from campId mapping or raw campId) */
  storeName: string;

  /** Store logo URL */
  storeLogoUrl?: string;

  /** Book format purchased (inferred from abpar2 or default) */
  format: PurchaseFormat;

  /** Purchase price */
  price: number;

  /** Currency code */
  currency: string;

  /** Original price before discount (if applicable) */
  originalPrice?: number;

  /** Timestamp of purchase */
  purchasedAt: string;

  /** Product title (as recorded by BUYBOX) */
  productTitle?: string;

  /** Transaction status from BUYBOX */
  status: BuyboxTransactionStatus;

  /** Publisher commission */
  commission?: number;

  /** Affiliate tracking info */
  affiliateData?: {
    campaign?: string;
    abpar1?: string;
    abpar2?: string;
    abpar3?: string;
  };
}

/**
 * Response from purchase history fetch
 */
export interface BuyboxPurchaseHistoryResponse {
  /** Whether the request was successful */
  success: boolean;

  /** List of purchases */
  purchases: BuyboxPurchaseData[];

  /** Pagination info */
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    totalPages: number;
  };

  /** Last sync timestamp */
  lastSyncAt?: string;

  /** Error message if success is false */
  error?: string;
}

/**
 * Normalized purchase for internal use
 */
export interface NormalizedPurchase {
  buyboxOrderId: string;
  bookIsbn?: string;
  bookEan?: string;
  bookId?: string;
  storeName: string;
  storeLogoUrl?: string;
  format: PurchaseFormat;
  price: number;
  currency: string;
  originalPrice?: number;
  purchasedAt: Date;
  productTitle?: string;
  status?: BuyboxTransactionStatus;
  commission?: number;
  matchedBook?: {
    id: string;
    title: string;
    coverUrl?: string;
  };
}

/**
 * Purchase sync result
 */
export interface PurchaseSyncResult {
  synced: number;
  new: number;
  updated: number;
  failed: number;
  errors: string[];
  syncedAt: Date;
}

/**
 * Purchase list response for API
 */
export interface PurchaseListResponse {
  purchases: PurchaseWithBook[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  lastSyncAt?: Date;
}

/**
 * Purchase with book details for frontend
 */
export interface PurchaseWithBook {
  id: string;
  buyboxOrderId?: string;
  storeName?: string;
  storeLogoUrl?: string;
  format?: PurchaseFormat;
  price?: number;
  currency: string;
  purchasedAt?: Date;
  syncedAt: Date;
  status?: BuyboxTransactionStatus;
  commission?: number;
  book?: {
    id: string;
    title: string;
    coverUrl?: string;
    authors: string[];
  };
}

/**
 * Provider configuration for BUYBOX Transactions API
 */
export interface BuyboxTransactionsConfig {
  /** BUYBOX API token */
  apiToken: string;

  /** BUYBOX Space ID (publisher account) */
  spaceId: string;

  /** API base URL */
  baseUrl: string;

  /** Request timeout in ms */
  timeout: number;

  /** Items per page (default 50) */
  perPage: number;

  /** Lookback days for initial sync (default 90) */
  lookbackDays: number;

  /** Maximum pages to fetch (safety limit) */
  maxPages: number;

  /** Maximum retries on failure */
  maxRetries: number;

  /** Cache TTL in seconds */
  cacheTtl: number;
}

/**
 * Legacy provider configuration (for backward compatibility)
 */
export interface PurchaseProviderConfig {
  widgetId: string;
  timeout: number;
  cacheTtl: number;
  baseUrl: string;
}

/**
 * Campaign ID to store name mapping
 * Used to display friendly store names
 */
export interface CampaignMapping {
  campId: string;
  storeName: string;
  storeLogoUrl?: string;
}

/**
 * Purchase provider interface
 * Allows swapping between mock and real BUYBOX implementations
 */
export interface IPurchaseProvider {
  /**
   * Fetch purchase history for a user
   * @param userId Internal user ID
   * @param options Fetch options
   */
  fetchPurchaseHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      forceRefresh?: boolean;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<BuyboxPurchaseHistoryResponse>;

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean;

  /**
   * Get provider name for logging
   */
  getProviderName(): string;
}

/**
 * Purchase provider token for dependency injection
 */
export const PURCHASE_PROVIDER_TOKEN = 'PURCHASE_PROVIDER';
