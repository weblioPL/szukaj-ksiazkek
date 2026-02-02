import { Injectable, Logger } from '@nestjs/common';
import {
  IPurchaseProvider,
  BuyboxPurchaseHistoryResponse,
  BuyboxPurchaseData,
  PurchaseFormat,
} from '../purchases.types';

/**
 * Mock Purchase Provider
 *
 * Simulates BUYBOX purchase history API for development and testing.
 * This provider generates realistic mock data and can be easily swapped
 * for the real BUYBOX implementation once the API is available.
 *
 * TODO: Replace with BuyboxPurchaseProvider when API spec is available
 */
@Injectable()
export class MockPurchaseProvider implements IPurchaseProvider {
  private readonly logger = new Logger(MockPurchaseProvider.name);

  // Mock data for realistic testing
  private readonly mockStores = [
    { name: 'Empik', logoUrl: 'https://example.com/empik-logo.png' },
    { name: 'Świat Książki', logoUrl: 'https://example.com/swiat-logo.png' },
    { name: 'Gandalf', logoUrl: 'https://example.com/gandalf-logo.png' },
    { name: 'Bonito', logoUrl: 'https://example.com/bonito-logo.png' },
    { name: 'Matras', logoUrl: 'https://example.com/matras-logo.png' },
    { name: 'Legimi', logoUrl: 'https://example.com/legimi-logo.png' },
    { name: 'Audioteka', logoUrl: 'https://example.com/audioteka-logo.png' },
  ];

  private readonly mockBooks = [
    { isbn: '9788328705326', title: 'Wiedźmin: Ostatnie życzenie' },
    { isbn: '9788375780635', title: 'Harry Potter i Kamień Filozoficzny' },
    { isbn: '9788381889605', title: 'Chłopi' },
    { isbn: '9788324061150', title: 'Zbrodnia i kara' },
    { isbn: '9788366611290', title: 'Diuna' },
    { isbn: '9788381161428', title: 'Władca Pierścieni' },
    { isbn: '9788328363779', title: 'Metro 2033' },
    { isbn: '9788308072318', title: 'Solaris' },
  ];

  private readonly formats: PurchaseFormat[] = ['paper', 'ebook', 'audiobook'];

  /**
   * Fetch mock purchase history
   * Generates deterministic data based on userId for consistency
   */
  async fetchPurchaseHistory(
    userId: string,
    options?: { page?: number; limit?: number; forceRefresh?: boolean },
  ): Promise<BuyboxPurchaseHistoryResponse> {
    this.logger.debug(
      `[MOCK] Fetching purchase history for user ${userId} (page: ${options?.page || 1})`,
    );

    // Simulate API latency
    await this.simulateLatency();

    const page = options?.page || 1;
    const limit = options?.limit || 20;

    // Generate deterministic number of purchases based on userId
    const userSeed = this.hashString(userId);
    const totalPurchases = (userSeed % 15) + 3; // 3-17 purchases per user

    // Generate purchases
    const allPurchases = this.generatePurchases(userId, totalPurchases);

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPurchases = allPurchases.slice(startIndex, endIndex);

    return {
      success: true,
      purchases: paginatedPurchases,
      pagination: {
        total: totalPurchases,
        page,
        limit,
        hasMore: endIndex < totalPurchases,
      },
      lastSyncAt: new Date().toISOString(),
    };
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    // Mock provider is always available
    return true;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'MockPurchaseProvider';
  }

  /**
   * Generate mock purchases for a user
   */
  private generatePurchases(
    userId: string,
    count: number,
  ): BuyboxPurchaseData[] {
    const purchases: BuyboxPurchaseData[] = [];
    const userSeed = this.hashString(userId);

    for (let i = 0; i < count; i++) {
      const purchaseSeed = userSeed + i;
      const book = this.mockBooks[purchaseSeed % this.mockBooks.length];
      const store = this.mockStores[purchaseSeed % this.mockStores.length];
      const format = this.formats[(purchaseSeed * 3) % this.formats.length];

      // Generate price based on format
      const basePrice = this.generatePrice(format, purchaseSeed);
      const hasDiscount = purchaseSeed % 3 === 0;
      const originalPrice = hasDiscount
        ? Math.round(basePrice * 1.2 * 100) / 100
        : undefined;

      // Generate purchase date (within last 2 years)
      const daysAgo = (purchaseSeed * 17) % 730; // Up to 2 years ago
      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - daysAgo);

      purchases.push({
        orderId: `MOCK-${userId.slice(0, 8)}-${i.toString().padStart(4, '0')}`,
        productIdentifier: book.isbn,
        identifierType: 'isbn',
        storeName: store.name,
        storeLogoUrl: store.logoUrl,
        format,
        price: basePrice,
        currency: 'PLN',
        originalPrice,
        purchasedAt: purchaseDate.toISOString(),
        productTitle: book.title,
        affiliateData: {
          campaign: 'mock-campaign',
          source: 'mock-source',
        },
      });
    }

    // Sort by purchase date (newest first)
    purchases.sort(
      (a, b) =>
        new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime(),
    );

    return purchases;
  }

  /**
   * Generate realistic price based on format
   */
  private generatePrice(format: PurchaseFormat, seed: number): number {
    const basePrices = {
      paper: 35 + (seed % 30), // 35-64 PLN
      ebook: 20 + (seed % 25), // 20-44 PLN
      audiobook: 30 + (seed % 35), // 30-64 PLN
    };

    return Math.round(basePrices[format] * 100) / 100;
  }

  /**
   * Simple hash function for deterministic generation
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simulate API latency (50-200ms)
   */
  private async simulateLatency(): Promise<void> {
    const delay = 50 + Math.random() * 150;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
