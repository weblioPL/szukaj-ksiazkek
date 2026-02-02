/**
 * Purchase Types
 *
 * Data contracts for BUYBOX purchase history integration.
 * These types define the interface between our system and the BUYBOX API.
 *
 * NOTE: The actual BUYBOX purchase-history API specification is pending.
 * These types are designed based on expected data and will be updated
 * once the official API documentation is available.
 */

/**
 * Purchase format from BUYBOX
 */
export type PurchaseFormat = 'paper' | 'ebook' | 'audiobook';

/**
 * Raw purchase data from BUYBOX API
 * This represents the expected response structure from BUYBOX
 *
 * TODO: Update this interface when BUYBOX purchase API spec is available
 */
export interface BuyboxPurchaseData {
  /** BUYBOX order/transaction ID */
  orderId: string;

  /** ISBN or EAN of the purchased book */
  productIdentifier: string;

  /** Type of identifier (isbn, ean, or internal) */
  identifierType: 'isbn' | 'ean' | 'internal';

  /** Store/retailer name */
  storeName: string;

  /** Store logo URL */
  storeLogoUrl?: string;

  /** Book format purchased */
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

  /** Affiliate tracking info */
  affiliateData?: {
    campaign?: string;
    source?: string;
  };
}

/**
 * Response from BUYBOX purchase history endpoint
 *
 * TODO: Update structure when BUYBOX API spec is available
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
  bookId?: string; // Resolved from our catalog
  storeName: string;
  storeLogoUrl?: string;
  format: PurchaseFormat;
  price: number;
  currency: string;
  originalPrice?: number;
  purchasedAt: Date;
  productTitle?: string;
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
  book?: {
    id: string;
    title: string;
    coverUrl?: string;
    authors: string[];
  };
}

/**
 * Provider configuration
 */
export interface PurchaseProviderConfig {
  /** BUYBOX widget ID */
  widgetId: string;

  /** API timeout in ms */
  timeout: number;

  /** Cache TTL in seconds */
  cacheTtl: number;

  /** Base URL for BUYBOX API */
  baseUrl: string;
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
    options?: { page?: number; limit?: number; forceRefresh?: boolean },
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
