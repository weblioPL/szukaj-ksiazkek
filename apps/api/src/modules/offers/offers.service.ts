import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BuyboxClient, NormalizedOffer } from '../buybox';
import { BookFormat } from '@prisma/client';

/**
 * Offers Service
 *
 * Manages book offers by:
 * - Fetching fresh offers from BUYBOX API
 * - Caching offers in database
 * - Serving offers to frontend
 *
 * BUYBOX is the single source of truth for offers.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly buyboxClient: BuyboxClient,
    private readonly configService: ConfigService,
  ) {
    // Cache TTL in seconds
    this.cacheTtl = this.configService.get<number>('buybox.cacheTtl') || 3600;
  }

  /**
   * Get offers for a book by its internal ID
   * Fetches from cache or BUYBOX API if cache is stale
   */
  async getOffersByBookId(bookId: string, format?: string) {
    // First, get the book to retrieve ISBN
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        isbn: true,
        ean: true,
        title: true,
        authors: {
          select: { author: { select: { name: true } } },
          take: 1,
        },
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Check if we have fresh cached offers
    const cachedOffers = await this.getCachedOffers(bookId, format);
    if (cachedOffers.length > 0) {
      this.logger.debug(`Returning ${cachedOffers.length} cached offers for book ${bookId}`);
      return { data: cachedOffers, source: 'cache' };
    }

    // Fetch fresh offers from BUYBOX
    const freshOffers = await this.fetchAndCacheOffers(book);

    // Filter by format if specified
    let filteredOffers = freshOffers;
    if (format) {
      filteredOffers = freshOffers.filter(
        (o) => o.format.toLowerCase() === format.toLowerCase(),
      );
    }

    return { data: filteredOffers, source: 'buybox' };
  }

  /**
   * Get offers directly by ISBN (for public API)
   */
  async getOffersByIsbn(isbn: string, format?: string) {
    // Check if we have a book with this ISBN
    const book = await this.prisma.book.findFirst({
      where: {
        OR: [{ isbn }, { ean: isbn }],
      },
      select: {
        id: true,
        isbn: true,
        ean: true,
        title: true,
        authors: {
          select: { author: { select: { name: true } } },
          take: 1,
        },
      },
    });

    if (book) {
      // Use the book-based flow for caching
      return this.getOffersByBookId(book.id, format);
    }

    // No book in catalog, fetch directly from BUYBOX without caching
    const result = await this.buyboxClient.fetchOffersByIsbn(isbn);

    if (!result.success) {
      this.logger.warn(`Failed to fetch offers for ISBN ${isbn}: ${result.error}`);
      return { data: [], source: 'buybox', error: result.error };
    }

    let offers = this.mapNormalizedToResponse(result.offers);
    if (format) {
      offers = offers.filter(
        (o) => o.format.toLowerCase() === format.toLowerCase(),
      );
    }

    return { data: offers, source: 'buybox' };
  }

  /**
   * Get lowest prices by format for a book
   */
  async getLowestPrices(bookId: string): Promise<Record<string, number>> {
    const offers = await this.prisma.offer.findMany({
      where: { bookId, isAvailable: true },
      orderBy: { price: 'asc' },
    });

    const lowestByFormat: Record<string, number> = {};

    for (const offer of offers) {
      const format = offer.format.toLowerCase();
      if (!lowestByFormat[format] || Number(offer.price) < lowestByFormat[format]) {
        lowestByFormat[format] = Number(offer.price);
      }
    }

    return lowestByFormat;
  }

  /**
   * Force refresh offers from BUYBOX for a book
   */
  async refreshOffers(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        isbn: true,
        ean: true,
        title: true,
        authors: {
          select: { author: { select: { name: true } } },
          take: 1,
        },
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Invalidate existing offers
    await this.prisma.offer.updateMany({
      where: { bookId },
      data: { isAvailable: false },
    });

    // Fetch fresh offers
    const freshOffers = await this.fetchAndCacheOffers(book);

    return { data: freshOffers, refreshedAt: new Date() };
  }

  /**
   * Get cached offers that are still valid
   */
  private async getCachedOffers(bookId: string, format?: string) {
    const expirationTime = new Date(Date.now() - this.cacheTtl * 1000);

    const where: any = {
      bookId,
      isAvailable: true,
      fetchedAt: { gte: expirationTime },
    };

    if (format) {
      where.format = this.normalizeFormatToEnum(format);
    }

    const offers = await this.prisma.offer.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    return offers.map((offer) => ({
      id: offer.id,
      storeName: offer.storeName,
      storeLogoUrl: offer.storeLogoUrl,
      format: offer.format.toLowerCase(),
      price: Number(offer.price),
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
      currency: offer.currency,
      url: offer.url,
      isAvailable: offer.isAvailable,
    }));
  }

  /**
   * Fetch offers from BUYBOX and cache them
   */
  private async fetchAndCacheOffers(book: {
    id: string;
    isbn: string | null;
    ean: string | null;
    title: string;
    authors: { author: { name: string } }[];
  }) {
    const isbn = book.isbn || book.ean;
    const authorName = book.authors[0]?.author.name;

    let result;

    // Try ISBN first (primary identifier)
    if (isbn) {
      result = await this.buyboxClient.fetchOffersByIsbn(isbn);
    }

    // Fallback to name + author if ISBN failed or no offers
    if ((!result || !result.success || result.offers.length === 0) && book.title) {
      this.logger.debug(`Falling back to name search for book: ${book.title}`);
      result = await this.buyboxClient.fetchOffersByName(book.title, authorName);
    }

    if (!result || !result.success) {
      this.logger.warn(`Failed to fetch offers for book ${book.id}: ${result?.error}`);
      return [];
    }

    // Mark old offers as unavailable
    await this.prisma.offer.updateMany({
      where: { bookId: book.id },
      data: { isAvailable: false },
    });

    // Insert new offers
    if (result.offers.length > 0) {
      await this.prisma.offer.createMany({
        data: result.offers.map((offer) => ({
          bookId: book.id,
          storeName: offer.storeName,
          storeLogoUrl: offer.storeLogoUrl,
          format: this.normalizeFormatToEnum(offer.format),
          price: offer.price,
          originalPrice: offer.originalPrice,
          currency: offer.currency,
          url: offer.url,
          isAvailable: offer.isAvailable,
          fetchedAt: result.fetchedAt,
        })),
      });

      // Update book format availability flags
      await this.updateBookFormats(book.id, result.offers);
    }

    return this.mapNormalizedToResponse(result.offers);
  }

  /**
   * Update book format availability based on offers
   */
  private async updateBookFormats(bookId: string, offers: NormalizedOffer[]) {
    const formats = new Set(offers.map((o) => o.format));

    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        hasPaper: formats.has('paper'),
        hasEbook: formats.has('ebook'),
        hasAudiobook: formats.has('audiobook'),
      },
    });
  }

  /**
   * Convert format string to Prisma enum
   */
  private normalizeFormatToEnum(format: string): BookFormat {
    const formatLower = format.toLowerCase();
    if (formatLower === 'ebook') return BookFormat.EBOOK;
    if (formatLower === 'audiobook') return BookFormat.AUDIOBOOK;
    return BookFormat.PAPER;
  }

  /**
   * Map normalized offers to response format
   */
  private mapNormalizedToResponse(offers: NormalizedOffer[]) {
    return offers.map((offer) => ({
      storeName: offer.storeName,
      storeLogoUrl: offer.storeLogoUrl,
      format: offer.format,
      price: offer.price,
      originalPrice: offer.originalPrice,
      currency: offer.currency,
      url: offer.url,
      isAvailable: offer.isAvailable,
    }));
  }
}
