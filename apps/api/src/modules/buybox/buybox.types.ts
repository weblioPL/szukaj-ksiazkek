/**
 * BUYBOX API Types
 *
 * Based on the official BUY.BOX API specification.
 * Endpoint format: https://buybox.click/{BB_ID}/buybox.json
 */

/**
 * Query parameters for BUYBOX API requests
 */
export interface BuyboxQueryParams {
  /** Product GTIN (ISBN/EAN) - primary identifier */
  number?: string;
  /** Product name (fallback if GTIN is not available) */
  name?: string;
  /** Additional product info (e.g., book author) */
  info?: string;
  /** Optional campaign / store filter */
  campaign?: string;
  /** Optional tracking parameters */
  p1?: string;
  p2?: string;
  p3?: string;
}

/**
 * Single offer from BUYBOX response
 */
export interface BuyboxOffer {
  /** Store/shop name */
  shop_name: string;
  /** Store logo URL */
  shop_logo?: string;
  /** Store icon URL (smaller version) */
  shop_icon?: string;
  /** Current price */
  price: number;
  /** Original price before discount (if applicable) */
  old_price?: number;
  /** Currency code (usually PLN) */
  currency: string;
  /** Product format identifier */
  format?: string;
  /** Format display name */
  format_name?: string;
  /** Direct purchase URL (affiliate link) */
  url: string;
  /** Product availability status */
  available?: boolean;
  /** Delivery information */
  delivery?: string;
  /** Delivery time */
  delivery_time?: string;
}

/**
 * BUYBOX API response structure
 */
export interface BuyboxResponse {
  /** Product identifier used in request */
  product_id?: string;
  /** Product name */
  product_name?: string;
  /** List of available offers */
  offers: BuyboxOffer[];
  /** Response timestamp */
  timestamp?: string;
  /** Error message if request failed */
  error?: string;
}

/**
 * Normalized offer format for internal use
 */
export interface NormalizedOffer {
  storeName: string;
  storeLogoUrl: string | null;
  format: 'paper' | 'ebook' | 'audiobook';
  price: number;
  originalPrice: number | null;
  currency: string;
  url: string;
  isAvailable: boolean;
  deliveryInfo: string | null;
}

/**
 * Result of fetching offers from BUYBOX
 */
export interface BuyboxFetchResult {
  success: boolean;
  offers: NormalizedOffer[];
  rawResponse?: BuyboxResponse;
  error?: string;
  fetchedAt: Date;
}
