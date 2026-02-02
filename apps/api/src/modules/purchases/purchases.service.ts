import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BookFormat } from '@prisma/client';
import {
  IPurchaseProvider,
  PURCHASE_PROVIDER_TOKEN,
  BuyboxPurchaseData,
  PurchaseFormat,
  PurchaseSyncResult,
  PurchaseListResponse,
  PurchaseWithBook,
} from './purchases.types';

/**
 * Purchase Service
 *
 * Handles purchase history synchronization, caching, and retrieval.
 * Works with any purchase provider (mock or real BUYBOX).
 *
 * Key responsibilities:
 * - Sync purchases from provider to database
 * - Match purchases to catalog books by ISBN/EAN
 * - Cache results with configurable TTL
 * - Provide purchase data for recommendations
 */
@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);
  private readonly cacheTtlSeconds: number;

  // In-memory sync state cache (per user)
  private readonly syncCache = new Map<
    string,
    { lastSync: Date; inProgress: boolean }
  >();

  constructor(
    @Inject(PURCHASE_PROVIDER_TOKEN)
    private readonly purchaseProvider: IPurchaseProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtlSeconds = this.configService.get<number>(
      'BUYBOX_CACHE_TTL',
      3600,
    );
    this.logger.log(
      `Purchase service initialized with provider: ${this.purchaseProvider.getProviderName()}`,
    );
  }

  /**
   * Get user's purchase history
   * Returns cached data if available and not expired
   */
  async getPurchases(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PurchaseListResponse> {
    // Check if we need to sync
    const needsSync = await this.needsSync(userId);

    if (needsSync) {
      // Sync in background, return current data immediately
      this.syncPurchasesBackground(userId).catch((err) => {
        this.logger.error(`Background sync failed for user ${userId}: ${err}`);
      });
    }

    // Get purchases from database
    const skip = (page - 1) * limit;

    const [purchases, total, lastSync] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { purchasedAt: 'desc' },
        include: {
          book: {
            include: {
              authors: {
                include: { author: true },
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
        },
      }),
      this.prisma.purchase.count({ where: { userId } }),
      this.getLastSyncTime(userId),
    ]);

    // Map to response format
    const mappedPurchases: PurchaseWithBook[] = purchases.map((p) => ({
      id: p.id,
      buyboxOrderId: p.buyboxOrderId || undefined,
      storeName: p.storeName || undefined,
      format: p.format ? this.prismaFormatToPurchaseFormat(p.format) : undefined,
      price: p.price ? Number(p.price) : undefined,
      currency: p.currency,
      purchasedAt: p.purchasedAt || undefined,
      syncedAt: p.syncedAt,
      book: p.book
        ? {
            id: p.book.id,
            title: p.book.title,
            coverUrl: p.book.coverUrl || undefined,
            authors: p.book.authors.map((a) => a.author.name),
          }
        : undefined,
    }));

    return {
      purchases: mappedPurchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      lastSyncAt: lastSync || undefined,
    };
  }

  /**
   * Force refresh purchase history from provider
   */
  async refreshPurchases(userId: string): Promise<PurchaseSyncResult> {
    return this.syncPurchases(userId, true);
  }

  /**
   * Sync purchases from provider to database
   */
  async syncPurchases(
    userId: string,
    forceRefresh = false,
  ): Promise<PurchaseSyncResult> {
    const syncState = this.syncCache.get(userId);

    // Prevent concurrent syncs
    if (syncState?.inProgress) {
      this.logger.debug(`Sync already in progress for user ${userId}`);
      return {
        synced: 0,
        new: 0,
        updated: 0,
        failed: 0,
        errors: ['Sync already in progress'],
        syncedAt: new Date(),
      };
    }

    // Mark sync as in progress
    this.syncCache.set(userId, {
      lastSync: syncState?.lastSync || new Date(0),
      inProgress: true,
    });

    const result: PurchaseSyncResult = {
      synced: 0,
      new: 0,
      updated: 0,
      failed: 0,
      errors: [],
      syncedAt: new Date(),
    };

    try {
      // Check if provider is available
      if (!this.purchaseProvider.isAvailable()) {
        this.logger.warn(
          `Purchase provider ${this.purchaseProvider.getProviderName()} is not available`,
        );
        result.errors.push('Purchase provider not available');
        return result;
      }

      // Fetch all pages from provider
      let page = 1;
      let hasMore = true;
      const allPurchases: BuyboxPurchaseData[] = [];

      while (hasMore) {
        const response = await this.purchaseProvider.fetchPurchaseHistory(
          userId,
          { page, limit: 50, forceRefresh },
        );

        if (!response.success) {
          result.errors.push(response.error || 'Unknown provider error');
          break;
        }

        allPurchases.push(...response.purchases);
        hasMore = response.pagination?.hasMore || false;
        page++;

        // Safety limit
        if (page > 10) {
          this.logger.warn(`Hit pagination limit for user ${userId}`);
          break;
        }
      }

      result.synced = allPurchases.length;

      // Process each purchase
      for (const purchase of allPurchases) {
        try {
          const processed = await this.processPurchase(userId, purchase);
          if (processed.isNew) {
            result.new++;
          } else {
            result.updated++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(
            `Failed to process order ${purchase.orderId}: ${error}`,
          );
        }
      }

      // Update sync state
      this.syncCache.set(userId, {
        lastSync: result.syncedAt,
        inProgress: false,
      });

      this.logger.log(
        `Synced ${result.synced} purchases for user ${userId} ` +
          `(${result.new} new, ${result.updated} updated, ${result.failed} failed)`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Sync failed for user ${userId}: ${error}`);
      result.errors.push(`Sync failed: ${error}`);

      // Reset sync state
      this.syncCache.set(userId, {
        lastSync: syncState?.lastSync || new Date(0),
        inProgress: false,
      });

      return result;
    }
  }

  /**
   * Process a single purchase from provider
   */
  private async processPurchase(
    userId: string,
    data: BuyboxPurchaseData,
  ): Promise<{ isNew: boolean }> {
    // Try to match book by ISBN or EAN
    const bookId = await this.matchBookToProduct(data);

    // Check if purchase already exists
    const existing = await this.prisma.purchase.findFirst({
      where: {
        userId,
        buyboxOrderId: data.orderId,
      },
    });

    if (existing) {
      // Update existing purchase
      await this.prisma.purchase.update({
        where: { id: existing.id },
        data: {
          bookId,
          storeName: data.storeName,
          format: this.purchaseFormatToPrismaFormat(data.format),
          price: data.price,
          currency: data.currency,
          syncedAt: new Date(),
        },
      });
      return { isNew: false };
    }

    // Create new purchase
    await this.prisma.purchase.create({
      data: {
        userId,
        bookId,
        buyboxOrderId: data.orderId,
        storeName: data.storeName,
        format: this.purchaseFormatToPrismaFormat(data.format),
        price: data.price,
        currency: data.currency,
        purchasedAt: new Date(data.purchasedAt),
        syncedAt: new Date(),
      },
    });

    return { isNew: true };
  }

  /**
   * Match BUYBOX product to catalog book
   */
  private async matchBookToProduct(
    data: BuyboxPurchaseData,
  ): Promise<string | null> {
    let book = null;

    // Try ISBN first
    if (data.identifierType === 'isbn' || data.identifierType === 'ean') {
      book = await this.prisma.book.findFirst({
        where: {
          OR: [
            { isbn: data.productIdentifier },
            { ean: data.productIdentifier },
          ],
        },
        select: { id: true },
      });
    }

    if (book) {
      return book.id;
    }

    // TODO: Implement fuzzy title matching as fallback
    // This would use the productTitle field to find approximate matches
    this.logger.debug(
      `Could not match product ${data.productIdentifier} to catalog`,
    );

    return null;
  }

  /**
   * Check if sync is needed based on cache TTL
   */
  private async needsSync(userId: string): Promise<boolean> {
    const syncState = this.syncCache.get(userId);

    if (!syncState || syncState.inProgress) {
      return !syncState?.inProgress;
    }

    const elapsed = Date.now() - syncState.lastSync.getTime();
    return elapsed > this.cacheTtlSeconds * 1000;
  }

  /**
   * Sync purchases in background
   */
  private async syncPurchasesBackground(userId: string): Promise<void> {
    await this.syncPurchases(userId, false);
  }

  /**
   * Get last sync time for user
   */
  private async getLastSyncTime(userId: string): Promise<Date | null> {
    const syncState = this.syncCache.get(userId);
    if (syncState?.lastSync && syncState.lastSync.getTime() > 0) {
      return syncState.lastSync;
    }

    // Check database for most recent sync
    const latest = await this.prisma.purchase.findFirst({
      where: { userId },
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });

    return latest?.syncedAt || null;
  }

  /**
   * Get user's purchased book IDs
   * Used by recommendation engine to exclude purchased books
   */
  async getPurchasedBookIds(userId: string): Promise<string[]> {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        userId,
        bookId: { not: null },
      },
      select: { bookId: true },
    });

    return purchases
      .map((p) => p.bookId)
      .filter((id): id is string => id !== null);
  }

  /**
   * Get user's purchase statistics
   * Used for preference inference
   */
  async getPurchaseStats(userId: string): Promise<{
    total: number;
    byFormat: Record<string, number>;
    byStore: Record<string, number>;
    totalSpent: number;
  }> {
    const purchases = await this.prisma.purchase.findMany({
      where: { userId },
      select: {
        format: true,
        storeName: true,
        price: true,
      },
    });

    const byFormat: Record<string, number> = {};
    const byStore: Record<string, number> = {};
    let totalSpent = 0;

    for (const p of purchases) {
      if (p.format) {
        byFormat[p.format] = (byFormat[p.format] || 0) + 1;
      }
      if (p.storeName) {
        byStore[p.storeName] = (byStore[p.storeName] || 0) + 1;
      }
      if (p.price) {
        totalSpent += Number(p.price);
      }
    }

    return {
      total: purchases.length,
      byFormat,
      byStore,
      totalSpent: Math.round(totalSpent * 100) / 100,
    };
  }

  /**
   * Convert purchase format to Prisma BookFormat
   */
  private purchaseFormatToPrismaFormat(format: PurchaseFormat): BookFormat {
    const mapping: Record<PurchaseFormat, BookFormat> = {
      paper: 'PAPER',
      ebook: 'EBOOK',
      audiobook: 'AUDIOBOOK',
    };
    return mapping[format];
  }

  /**
   * Convert Prisma BookFormat to purchase format
   */
  private prismaFormatToPurchaseFormat(format: BookFormat): PurchaseFormat {
    const mapping: Record<BookFormat, PurchaseFormat> = {
      PAPER: 'paper',
      EBOOK: 'ebook',
      AUDIOBOOK: 'audiobook',
    };
    return mapping[format];
  }
}
