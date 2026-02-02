import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPurchaseProvider,
  BuyboxPurchaseHistoryResponse,
  BuyboxPurchaseData,
  BuyboxTransactionRaw,
  BuyboxTransactionsApiResponse,
  BuyboxTransactionsConfig,
  BuyboxTransactionStatus,
  PurchaseFormat,
  CampaignMapping,
} from '../purchases.types';

/**
 * BUYBOX Purchase Provider
 *
 * Real implementation for fetching purchase history from BUYBOX Transactions API.
 *
 * API Endpoint: GET /api/v1/spaces/{spaceId}/transactions
 * Base URL: https://api.buybox.click
 *
 * Features:
 * - Pagination support with safety limits
 * - Retry logic with exponential backoff
 * - ISBN/EAN extraction from tracking parameters
 * - Campaign ID to store name mapping
 *
 * @see /docs/BUYBOX_TRANSACTIONS_API.md for full documentation
 */
@Injectable()
export class BuyboxPurchaseProvider implements IPurchaseProvider {
  private readonly logger = new Logger(BuyboxPurchaseProvider.name);
  private readonly config: BuyboxTransactionsConfig;
  private readonly isConfigured: boolean;

  // Known campaign mappings (can be extended via config or DB)
  private readonly campaignMappings: Map<string, CampaignMapping> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.config = {
      apiToken: this.configService.get<string>('BUYBOX_API_TOKEN', ''),
      spaceId: this.configService.get<string>('BUYBOX_SPACE_ID', ''),
      baseUrl: this.configService.get<string>(
        'BUYBOX_API_BASE_URL',
        'https://api.buybox.click',
      ),
      timeout: this.configService.get<number>('BUYBOX_TIMEOUT', 10000),
      perPage: this.configService.get<number>(
        'BUYBOX_TRANSACTIONS_PER_PAGE',
        50,
      ),
      lookbackDays: this.configService.get<number>(
        'BUYBOX_TRANSACTIONS_LOOKBACK_DAYS',
        90,
      ),
      maxPages: this.configService.get<number>(
        'BUYBOX_TRANSACTIONS_MAX_PAGES',
        20,
      ),
      maxRetries: this.configService.get<number>('BUYBOX_MAX_RETRIES', 3),
      cacheTtl: this.configService.get<number>('BUYBOX_CACHE_TTL', 3600),
    };

    this.isConfigured = !!(this.config.apiToken && this.config.spaceId);

    if (!this.isConfigured) {
      this.logger.warn(
        'BUYBOX Transactions API not configured: ' +
          'missing BUYBOX_API_TOKEN or BUYBOX_SPACE_ID',
      );
    } else {
      this.logger.log(
        `BUYBOX Transactions API configured for space: ${this.config.spaceId}`,
      );
    }

    // Initialize known campaign mappings
    this.initializeCampaignMappings();
  }

  /**
   * Initialize campaign ID to store name mappings
   * These can be extended via environment variable or database
   */
  private initializeCampaignMappings(): void {
    // Load from environment if available (JSON format)
    const mappingsJson = this.configService.get<string>(
      'BUYBOX_CAMPAIGN_MAPPINGS',
      '',
    );

    if (mappingsJson) {
      try {
        const mappings = JSON.parse(mappingsJson) as CampaignMapping[];
        for (const mapping of mappings) {
          this.campaignMappings.set(mapping.campId, mapping);
        }
        this.logger.debug(
          `Loaded ${this.campaignMappings.size} campaign mappings`,
        );
      } catch (error) {
        this.logger.warn(`Failed to parse BUYBOX_CAMPAIGN_MAPPINGS: ${error}`);
      }
    }

    // Default mappings for common Polish bookstores
    // These are placeholders - actual campIds would come from BUYBOX
    const defaultMappings: CampaignMapping[] = [
      { campId: 'empik', storeName: 'Empik' },
      { campId: 'swiat-ksiazki', storeName: 'Świat Książki' },
      { campId: 'gandalf', storeName: 'Gandalf' },
      { campId: 'bonito', storeName: 'Bonito' },
      { campId: 'matras', storeName: 'Matras' },
      { campId: 'legimi', storeName: 'Legimi' },
      { campId: 'audioteka', storeName: 'Audioteka' },
      { campId: 'virtualo', storeName: 'Virtualo' },
      { campId: 'woblink', storeName: 'Woblink' },
    ];

    for (const mapping of defaultMappings) {
      if (!this.campaignMappings.has(mapping.campId)) {
        this.campaignMappings.set(mapping.campId, mapping);
      }
    }
  }

  /**
   * Fetch purchase history from BUYBOX Transactions API
   */
  async fetchPurchaseHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      forceRefresh?: boolean;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<BuyboxPurchaseHistoryResponse> {
    if (!this.isConfigured) {
      return {
        success: false,
        purchases: [],
        error: 'BUYBOX Transactions API not configured',
      };
    }

    const page = options?.page || 1;
    const limit = options?.limit || this.config.perPage;

    // Calculate date range
    const toDate = options?.toDate || new Date();
    const fromDate =
      options?.fromDate ||
      new Date(
        toDate.getTime() - this.config.lookbackDays * 24 * 60 * 60 * 1000,
      );

    try {
      // Fetch single page
      const response = await this.fetchTransactionsPage(
        page,
        limit,
        fromDate,
        toDate,
      );

      if (!response.success) {
        return response;
      }

      // Calculate pagination
      const totalPages = response.totalPages || 1;
      const hasMore = page < totalPages;

      return {
        success: true,
        purchases: response.purchases,
        pagination: {
          total: response.totalCount || response.purchases.length,
          page,
          limit,
          hasMore,
          totalPages,
        },
        lastSyncAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch transactions for user ${userId}: ${error}`,
      );
      return {
        success: false,
        purchases: [],
        error: `BUYBOX API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch a single page of transactions from BUYBOX API
   */
  private async fetchTransactionsPage(
    page: number,
    perPage: number,
    fromDate: Date,
    toDate: Date,
    retryCount = 0,
  ): Promise<{
    success: boolean;
    purchases: BuyboxPurchaseData[];
    totalPages?: number;
    totalCount?: number;
    error?: string;
  }> {
    const url = this.buildApiUrl(page, perPage, fromDate, toDate);

    try {
      this.logger.debug(`Fetching transactions page ${page} from BUYBOX`);

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: BuyboxTransactionsApiResponse = await response.json();

      // Handle API error response
      if (data.error || data.message) {
        throw new Error(data.error || data.message);
      }

      // Extract transactions from response (handle different response formats)
      const rawTransactions = data.transactions || data.data || [];

      // Transform raw transactions to normalized format
      const purchases = rawTransactions.map((t) =>
        this.transformTransaction(t),
      );

      return {
        success: true,
        purchases,
        totalPages: data.count || 1,
        totalCount: rawTransactions.length,
      };
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`BUYBOX API timeout on page ${page}`);

        if (retryCount < this.config.maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          this.logger.debug(`Retrying in ${delay}ms (attempt ${retryCount + 1})`);
          await this.sleep(delay);
          return this.fetchTransactionsPage(
            page,
            perPage,
            fromDate,
            toDate,
            retryCount + 1,
          );
        }

        return {
          success: false,
          purchases: [],
          error: 'BUYBOX API timeout after retries',
        };
      }

      // Handle network errors with retry
      if (
        error instanceof TypeError &&
        error.message.includes('fetch') &&
        retryCount < this.config.maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        this.logger.warn(
          `Network error, retrying in ${delay}ms (attempt ${retryCount + 1})`,
        );
        await this.sleep(delay);
        return this.fetchTransactionsPage(
          page,
          perPage,
          fromDate,
          toDate,
          retryCount + 1,
        );
      }

      throw error;
    }
  }

  /**
   * Build the API URL with query parameters
   */
  private buildApiUrl(
    page: number,
    perPage: number,
    fromDate: Date,
    toDate: Date,
    transactionId?: string,
    campaignId?: string,
  ): string {
    const baseUrl = `${this.config.baseUrl}/api/v1/spaces/${this.config.spaceId}/transactions`;

    const params = new URLSearchParams();
    params.set('api-token', this.config.apiToken);
    params.set('page', String(page));
    params.set('per-page', String(perPage));
    params.set('from', this.formatDate(fromDate));
    params.set('to', this.formatDate(toDate));

    if (transactionId) {
      params.set('transaction', transactionId);
    }

    if (campaignId) {
      params.set('campaign', campaignId);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Transform raw BUYBOX transaction to normalized purchase data
   */
  private transformTransaction(raw: BuyboxTransactionRaw): BuyboxPurchaseData {
    // Extract product identifier from tracking params
    const { identifier, identifierType } = this.extractProductIdentifier(raw);

    // Get store name from campaign mapping
    const campaignInfo = this.getCampaignInfo(raw.campId);

    // Infer format from abpar2 or default to paper
    const format = this.inferFormat(raw.abpar2);

    return {
      orderId: raw.transId,
      productIdentifier: identifier,
      identifierType,
      storeName: campaignInfo.storeName,
      storeLogoUrl: campaignInfo.storeLogoUrl,
      format,
      price: raw.amount,
      currency: 'PLN', // BUYBOX is Polish-focused
      purchasedAt: raw.date,
      status: raw.status,
      commission: raw.publisherCommissionAmount,
      affiliateData: {
        campaign: raw.campId,
        abpar1: raw.abpar1,
        abpar2: raw.abpar2,
        abpar3: raw.abpar3,
      },
    };
  }

  /**
   * Extract ISBN/EAN from tracking parameters
   *
   * BUYBOX tracking params (abpar1, abpar2, abpar3) are set during click
   * and can contain product identifiers. The convention varies by integration:
   * - abpar1: Often used for ISBN-13 or EAN
   * - abpar2: Sometimes used for format or secondary identifier
   * - abpar3: Additional tracking data
   */
  private extractProductIdentifier(raw: BuyboxTransactionRaw): {
    identifier: string;
    identifierType: 'isbn' | 'ean' | 'internal';
  } {
    // Try abpar1 first (most common for ISBN/EAN)
    if (raw.abpar1) {
      const normalized = raw.abpar1.replace(/[-\s]/g, '');

      // ISBN-13 (13 digits starting with 978 or 979)
      if (/^97[89]\d{10}$/.test(normalized)) {
        return { identifier: normalized, identifierType: 'isbn' };
      }

      // ISBN-10 (10 digits/chars, last can be X)
      if (/^\d{9}[\dX]$/.test(normalized)) {
        return { identifier: normalized, identifierType: 'isbn' };
      }

      // EAN-13 (13 digits, not starting with 978/979)
      if (/^\d{13}$/.test(normalized)) {
        return { identifier: normalized, identifierType: 'ean' };
      }

      // Use as internal identifier if it has value
      if (normalized.length > 0) {
        return { identifier: raw.abpar1, identifierType: 'internal' };
      }
    }

    // Try abpar3 as fallback
    if (raw.abpar3) {
      const normalized = raw.abpar3.replace(/[-\s]/g, '');
      if (/^97[89]\d{10}$/.test(normalized) || /^\d{13}$/.test(normalized)) {
        return {
          identifier: normalized,
          identifierType: normalized.startsWith('978') || normalized.startsWith('979')
            ? 'isbn'
            : 'ean',
        };
      }
    }

    // No identifier found - use transaction ID as fallback
    return { identifier: raw.transId, identifierType: 'internal' };
  }

  /**
   * Get campaign info (store name and logo) from campaign ID
   */
  private getCampaignInfo(campId: string): {
    storeName: string;
    storeLogoUrl?: string;
  } {
    const mapping = this.campaignMappings.get(campId);

    if (mapping) {
      return {
        storeName: mapping.storeName,
        storeLogoUrl: mapping.storeLogoUrl,
      };
    }

    // Unknown campaign - use campId as store name
    return {
      storeName: campId,
    };
  }

  /**
   * Infer book format from tracking parameter
   */
  private inferFormat(abpar2?: string): PurchaseFormat {
    if (!abpar2) {
      return 'paper'; // Default to paper
    }

    const lower = abpar2.toLowerCase();

    if (
      lower.includes('ebook') ||
      lower.includes('e-book') ||
      lower.includes('epub') ||
      lower.includes('mobi') ||
      lower.includes('pdf')
    ) {
      return 'ebook';
    }

    if (
      lower.includes('audio') ||
      lower.includes('mp3') ||
      lower.includes('audiobook')
    ) {
      return 'audiobook';
    }

    return 'paper';
  }

  /**
   * Format date as YYYY-MM-DD for API
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Sleep utility for retry delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if provider is available and configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'BuyboxPurchaseProvider';
  }
}
