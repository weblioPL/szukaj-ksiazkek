import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BuyboxQueryParams,
  BuyboxResponse,
  BuyboxOffer,
  BuyboxFetchResult,
  NormalizedOffer,
} from './buybox.types';

/**
 * BUYBOX API Client
 *
 * Encapsulates all communication with the BUY.BOX API.
 * Endpoint format: https://buybox.click/{WIDGET_ID}/buybox.json
 *
 * This client:
 * - Builds URLs dynamically based on widget ID from environment
 * - Handles request/response transformation
 * - Normalizes offers to internal format
 * - Provides error handling and logging
 */
@Injectable()
export class BuyboxClient implements OnModuleInit {
  private readonly logger = new Logger(BuyboxClient.name);
  private readonly baseUrl: string;
  private readonly widgetId: string | undefined;
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('buybox.baseUrl')!;
    this.widgetId = this.configService.get<string>('buybox.widgetId');
    this.timeout = this.configService.get<number>('buybox.timeout')!;
  }

  onModuleInit() {
    if (!this.widgetId) {
      this.logger.warn(
        'BUYBOX_WIDGET_ID is not configured. BUYBOX API calls will fail.',
      );
    } else {
      this.logger.log(`BUYBOX client initialized with widget ID: ${this.widgetId}`);
    }
  }

  /**
   * Check if BUYBOX client is properly configured
   */
  isConfigured(): boolean {
    return !!this.widgetId;
  }

  /**
   * Build the full API URL for a request
   */
  private buildUrl(params: BuyboxQueryParams): string {
    if (!this.widgetId) {
      throw new Error('BUYBOX_WIDGET_ID is not configured');
    }

    const url = new URL(`${this.baseUrl}/${this.widgetId}/buybox.json`);

    // Add query parameters
    if (params.number) {
      url.searchParams.set('number', params.number);
    }
    if (params.name) {
      url.searchParams.set('name', params.name);
    }
    if (params.info) {
      url.searchParams.set('info', params.info);
    }
    if (params.campaign) {
      url.searchParams.set('campaign', params.campaign);
    }
    if (params.p1) {
      url.searchParams.set('p1', params.p1);
    }
    if (params.p2) {
      url.searchParams.set('p2', params.p2);
    }
    if (params.p3) {
      url.searchParams.set('p3', params.p3);
    }

    return url.toString();
  }

  /**
   * Fetch offers by ISBN/EAN (primary method)
   */
  async fetchOffersByIsbn(isbn: string): Promise<BuyboxFetchResult> {
    return this.fetchOffers({ number: isbn });
  }

  /**
   * Fetch offers by product name (fallback method)
   */
  async fetchOffersByName(name: string, author?: string): Promise<BuyboxFetchResult> {
    return this.fetchOffers({ name, info: author });
  }

  /**
   * Fetch offers from BUYBOX API
   */
  async fetchOffers(params: BuyboxQueryParams): Promise<BuyboxFetchResult> {
    const fetchedAt = new Date();

    if (!this.isConfigured()) {
      return {
        success: false,
        offers: [],
        error: 'BUYBOX_WIDGET_ID is not configured',
        fetchedAt,
      };
    }

    try {
      const url = this.buildUrl(params);
      this.logger.debug(`Fetching offers from: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SzukajKsiazek/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: BuyboxResponse = await response.json();

      if (data.error) {
        return {
          success: false,
          offers: [],
          rawResponse: data,
          error: data.error,
          fetchedAt,
        };
      }

      const normalizedOffers = this.normalizeOffers(data.offers || []);

      this.logger.debug(
        `Fetched ${normalizedOffers.length} offers for ${params.number || params.name}`,
      );

      return {
        success: true,
        offers: normalizedOffers,
        rawResponse: data,
        fetchedAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Failed to fetch offers: ${errorMessage}`);

      return {
        success: false,
        offers: [],
        error: errorMessage,
        fetchedAt,
      };
    }
  }

  /**
   * Normalize BUYBOX offers to internal format
   */
  private normalizeOffers(offers: BuyboxOffer[]): NormalizedOffer[] {
    return offers.map((offer) => ({
      storeName: offer.shop_name,
      storeLogoUrl: offer.shop_logo || offer.shop_icon || null,
      format: this.normalizeFormat(offer.format, offer.format_name),
      price: offer.price,
      originalPrice: offer.old_price || null,
      currency: offer.currency || 'PLN',
      url: offer.url,
      isAvailable: offer.available !== false,
      deliveryInfo: offer.delivery || offer.delivery_time || null,
    }));
  }

  /**
   * Normalize format string to internal enum value
   */
  private normalizeFormat(
    format?: string,
    formatName?: string,
  ): 'paper' | 'ebook' | 'audiobook' {
    const formatStr = (format || formatName || '').toLowerCase();

    // Check for ebook indicators
    if (
      formatStr.includes('ebook') ||
      formatStr.includes('e-book') ||
      formatStr.includes('epub') ||
      formatStr.includes('mobi') ||
      formatStr.includes('pdf') ||
      formatStr.includes('kindle')
    ) {
      return 'ebook';
    }

    // Check for audiobook indicators
    if (
      formatStr.includes('audio') ||
      formatStr.includes('mp3') ||
      formatStr.includes('audiobook') ||
      formatStr.includes('słuchowisko')
    ) {
      return 'audiobook';
    }

    // Default to paper (physical book)
    return 'paper';
  }
}
