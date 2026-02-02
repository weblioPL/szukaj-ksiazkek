import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  UserPreferences,
  CategoryAffinity,
  AuthorAffinity,
  FormatAffinity,
  ReadingStats,
  PreferenceConfig,
  DEFAULT_PREFERENCE_CONFIG,
  AffinityScore,
} from './preferences.types';

/**
 * Preferences Service
 *
 * Aggregates user preference signals from bookshelf, purchases, and catalog data.
 * Used internally by recommendation engine and Claude context builder.
 *
 * Heuristics:
 * - Higher rating = higher weight (rating / 5)
 * - More recent = higher weight (exponential decay)
 * - READ > READING > WANT_TO_READ (status weights)
 * - Purchases count toward format affinity
 *
 * All scores normalized to 0..1 range.
 * Deterministic: same input → same output.
 */
@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);
  private readonly config: PreferenceConfig;

  constructor(private readonly prisma: PrismaService) {
    this.config = DEFAULT_PREFERENCE_CONFIG;
  }

  /**
   * Get complete user preferences snapshot
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const [categories, authors, formats, stats, negativeCategories, negativeAuthors] =
      await Promise.all([
        this.getCategoryAffinity(userId),
        this.getAuthorAffinity(userId),
        this.getFormatAffinity(userId),
        this.getReadingStats(userId),
        this.getNegativeCategorySignals(userId),
        this.getNegativeAuthorSignals(userId),
      ]);

    // Calculate data quality
    const lastRating = await this.prisma.userBook.findFirst({
      where: { userId, rating: { not: null } },
      orderBy: { ratedAt: 'desc' },
      select: { ratedAt: true },
    });

    const lastActivity = await this.prisma.userBook.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const hasEnoughData = stats.ratings.count >= this.config.minSamplesForReliability;
    const confidence = this.calculateConfidence(stats);

    return {
      userId,
      calculatedAt: new Date(),
      categories,
      authors,
      formats,
      stats,
      negativeSignals: {
        categories: negativeCategories,
        authors: negativeAuthors,
      },
      dataQuality: {
        hasEnoughData,
        lastRatingAt: lastRating?.ratedAt || undefined,
        lastActivityAt: lastActivity?.updatedAt || undefined,
        confidence,
      },
    };
  }

  /**
   * Get category affinity scores
   *
   * Heuristic:
   * - Weight = statusWeight * ratingWeight * recencyWeight
   * - Aggregate by category, normalize to 0..1
   */
  async getCategoryAffinity(userId: string): Promise<CategoryAffinity[]> {
    // Fetch user's books with categories and ratings
    const userBooks = await this.prisma.userBook.findMany({
      where: { userId },
      include: {
        book: {
          include: {
            categories: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (userBooks.length === 0) {
      return [];
    }

    // Aggregate scores by category
    const categoryScores = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        totalWeight: number;
        count: number;
        totalRating: number;
        ratedCount: number;
      }
    >();

    const now = Date.now();

    for (const ub of userBooks) {
      const weight = this.calculateBookWeight(ub, now);

      for (const bc of ub.book.categories) {
        const cat = bc.category;
        const existing = categoryScores.get(cat.id) || {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          parentId: cat.parentId,
          totalWeight: 0,
          count: 0,
          totalRating: 0,
          ratedCount: 0,
        };

        existing.totalWeight += weight;
        existing.count += 1;

        if (ub.rating !== null) {
          existing.totalRating += ub.rating;
          existing.ratedCount += 1;
        }

        categoryScores.set(cat.id, existing);
      }
    }

    // Convert to array and normalize
    const maxWeight = Math.max(...Array.from(categoryScores.values()).map((c) => c.totalWeight));

    const results: CategoryAffinity[] = Array.from(categoryScores.values())
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId || undefined,
        score: maxWeight > 0 ? cat.totalWeight / maxWeight : 0,
        sampleCount: cat.count,
        averageRating: cat.ratedCount > 0 ? cat.totalRating / cat.ratedCount : undefined,
      }))
      .filter((cat) => cat.score > 0)
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Get author affinity scores
   */
  async getAuthorAffinity(userId: string): Promise<AuthorAffinity[]> {
    const userBooks = await this.prisma.userBook.findMany({
      where: { userId },
      include: {
        book: {
          include: {
            authors: {
              include: { author: true },
            },
          },
        },
      },
    });

    if (userBooks.length === 0) {
      return [];
    }

    // Aggregate scores by author
    const authorScores = new Map<
      string,
      {
        id: string;
        name: string;
        totalWeight: number;
        count: number;
        booksRead: number;
        totalRating: number;
        ratedCount: number;
      }
    >();

    const now = Date.now();

    for (const ub of userBooks) {
      const weight = this.calculateBookWeight(ub, now);
      const isRead = ub.status === 'READ';

      for (const ba of ub.book.authors) {
        const author = ba.author;
        const existing = authorScores.get(author.id) || {
          id: author.id,
          name: author.name,
          totalWeight: 0,
          count: 0,
          booksRead: 0,
          totalRating: 0,
          ratedCount: 0,
        };

        existing.totalWeight += weight;
        existing.count += 1;

        if (isRead) {
          existing.booksRead += 1;
        }

        if (ub.rating !== null) {
          existing.totalRating += ub.rating;
          existing.ratedCount += 1;
        }

        authorScores.set(author.id, existing);
      }
    }

    // Convert to array and normalize
    const maxWeight = Math.max(...Array.from(authorScores.values()).map((a) => a.totalWeight));

    const results: AuthorAffinity[] = Array.from(authorScores.values())
      .map((author) => ({
        id: author.id,
        name: author.name,
        score: maxWeight > 0 ? author.totalWeight / maxWeight : 0,
        sampleCount: author.count,
        booksRead: author.booksRead,
        averageRating: author.ratedCount > 0 ? author.totalRating / author.ratedCount : undefined,
      }))
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Get format affinity scores
   *
   * Combines bookshelf format availability and purchase formats.
   */
  async getFormatAffinity(userId: string): Promise<FormatAffinity[]> {
    // Get format preferences from bookshelf (based on book format availability)
    const bookshelfFormats = await this.prisma.userBook.findMany({
      where: { userId },
      include: {
        book: {
          select: {
            hasPaper: true,
            hasEbook: true,
            hasAudiobook: true,
          },
        },
      },
    });

    // Get format preferences from purchases
    const purchaseFormats = await this.prisma.purchase.groupBy({
      by: ['format'],
      where: { userId, format: { not: null } },
      _count: { format: true },
    });

    // Initialize counters
    const formats: Record<string, { bookshelf: number; purchases: number }> = {
      paper: { bookshelf: 0, purchases: 0 },
      ebook: { bookshelf: 0, purchases: 0 },
      audiobook: { bookshelf: 0, purchases: 0 },
    };

    // Count bookshelf (weight by what formats the books have)
    for (const ub of bookshelfFormats) {
      if (ub.book.hasPaper) formats.paper.bookshelf += 1;
      if (ub.book.hasEbook) formats.ebook.bookshelf += 1;
      if (ub.book.hasAudiobook) formats.audiobook.bookshelf += 1;
    }

    // Count purchases (stronger signal)
    for (const pf of purchaseFormats) {
      if (pf.format) {
        const key = pf.format.toLowerCase() as 'paper' | 'ebook' | 'audiobook';
        if (formats[key]) {
          formats[key].purchases = pf._count.format;
        }
      }
    }

    // Calculate scores (purchases weighted 2x)
    const totals = Object.entries(formats).map(([format, counts]) => ({
      format: format as 'paper' | 'ebook' | 'audiobook',
      fromBookshelf: counts.bookshelf,
      fromPurchases: counts.purchases,
      total: counts.bookshelf + counts.purchases * 2,
    }));

    const maxTotal = Math.max(...totals.map((t) => t.total));

    return totals
      .map((t) => ({
        ...t,
        score: maxTotal > 0 ? t.total / maxTotal : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get reading statistics
   */
  async getReadingStats(userId: string): Promise<ReadingStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [statusCounts, ratingStats, ratingDistribution, recentAdded, recentRated, recentFinished] =
      await Promise.all([
        // Status counts
        this.prisma.userBook.groupBy({
          by: ['status'],
          where: { userId },
          _count: { status: true },
        }),

        // Rating aggregates
        this.prisma.userBook.aggregate({
          where: { userId, rating: { not: null } },
          _avg: { rating: true },
          _count: { rating: true },
        }),

        // Rating distribution
        this.prisma.userBook.groupBy({
          by: ['rating'],
          where: { userId, rating: { not: null } },
          _count: { rating: true },
        }),

        // Recent activity: added
        this.prisma.userBook.count({
          where: { userId, createdAt: { gte: thirtyDaysAgo } },
        }),

        // Recent activity: rated
        this.prisma.userBook.count({
          where: { userId, ratedAt: { gte: thirtyDaysAgo } },
        }),

        // Recent activity: finished
        this.prisma.userBook.count({
          where: { userId, finishedAt: { gte: thirtyDaysAgo } },
        }),
      ]);

    // Process status counts
    const byStatus = {
      wantToRead: 0,
      reading: 0,
      read: 0,
    };

    for (const sc of statusCounts) {
      switch (sc.status) {
        case 'WANT_TO_READ':
          byStatus.wantToRead = sc._count.status;
          break;
        case 'READING':
          byStatus.reading = sc._count.status;
          break;
        case 'READ':
          byStatus.read = sc._count.status;
          break;
      }
    }

    // Process rating distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const rd of ratingDistribution) {
      if (rd.rating !== null) {
        distribution[rd.rating] = rd._count.rating;
      }
    }

    return {
      totalBooks: byStatus.wantToRead + byStatus.reading + byStatus.read,
      byStatus,
      ratings: {
        count: ratingStats._count.rating,
        average: ratingStats._avg.rating
          ? Math.round(ratingStats._avg.rating * 10) / 10
          : 0,
        distribution,
      },
      recentActivity: {
        booksAdded: recentAdded,
        booksRated: recentRated,
        booksFinished: recentFinished,
      },
    };
  }

  /**
   * Get negative category signals (low-rated categories)
   */
  async getNegativeCategorySignals(userId: string): Promise<CategoryAffinity[]> {
    const lowRatedBooks = await this.prisma.userBook.findMany({
      where: {
        userId,
        rating: { lte: this.config.negativeRatingThreshold },
      },
      include: {
        book: {
          include: {
            categories: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (lowRatedBooks.length === 0) {
      return [];
    }

    // Aggregate negative scores by category
    const categoryScores = new Map<
      string,
      { id: string; name: string; slug: string; count: number; totalRating: number }
    >();

    for (const ub of lowRatedBooks) {
      for (const bc of ub.book.categories) {
        const cat = bc.category;
        const existing = categoryScores.get(cat.id) || {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          count: 0,
          totalRating: 0,
        };

        existing.count += 1;
        existing.totalRating += ub.rating || 0;

        categoryScores.set(cat.id, existing);
      }
    }

    // Only return categories with multiple low ratings (avoid single bad book)
    return Array.from(categoryScores.values())
      .filter((cat) => cat.count >= 2)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        score: cat.count / lowRatedBooks.length, // Proportion of low-rated books
        sampleCount: cat.count,
        averageRating: cat.totalRating / cat.count,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get negative author signals (low-rated authors)
   */
  async getNegativeAuthorSignals(userId: string): Promise<AuthorAffinity[]> {
    const lowRatedBooks = await this.prisma.userBook.findMany({
      where: {
        userId,
        rating: { lte: this.config.negativeRatingThreshold },
      },
      include: {
        book: {
          include: {
            authors: {
              include: { author: true },
            },
          },
        },
      },
    });

    if (lowRatedBooks.length === 0) {
      return [];
    }

    // Aggregate negative scores by author
    const authorScores = new Map<
      string,
      { id: string; name: string; count: number; totalRating: number }
    >();

    for (const ub of lowRatedBooks) {
      for (const ba of ub.book.authors) {
        const author = ba.author;
        const existing = authorScores.get(author.id) || {
          id: author.id,
          name: author.name,
          count: 0,
          totalRating: 0,
        };

        existing.count += 1;
        existing.totalRating += ub.rating || 0;

        authorScores.set(author.id, existing);
      }
    }

    // Only return authors with multiple low ratings
    return Array.from(authorScores.values())
      .filter((a) => a.count >= 2)
      .map((a) => ({
        id: a.id,
        name: a.name,
        score: a.count / lowRatedBooks.length,
        sampleCount: a.count,
        booksRead: a.count,
        averageRating: a.totalRating / a.count,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate weight for a single book entry
   *
   * Weight = statusWeight * ratingWeight * recencyWeight
   */
  calculateBookWeight(
    userBook: { status: string; rating: number | null; ratedAt: Date | null; updatedAt: Date },
    now: number,
  ): number {
    // Status weight
    const statusWeight =
      this.config.statusWeights[userBook.status.toLowerCase() as keyof typeof this.config.statusWeights] ||
      0.1;

    // Rating weight (1-5 mapped to 0.2-1.0, neutral if no rating)
    const ratingWeight = userBook.rating !== null ? userBook.rating / 5 : 0.5;

    // Recency weight (exponential decay)
    const referenceDate = userBook.ratedAt || userBook.updatedAt;
    const daysSince = (now - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.exp(-daysSince / this.config.recencyDecayDays);

    return statusWeight * ratingWeight * recencyWeight;
  }

  /**
   * Calculate overall confidence in preferences
   */
  private calculateConfidence(stats: ReadingStats): number {
    // Factors:
    // - Number of rated books (most important)
    // - Total books in bookshelf
    // - Recent activity

    const ratedBooksScore = Math.min(stats.ratings.count / 20, 1); // Max at 20 ratings
    const totalBooksScore = Math.min(stats.totalBooks / 50, 1); // Max at 50 books
    const activityScore =
      Math.min((stats.recentActivity.booksRated + stats.recentActivity.booksFinished) / 5, 1);

    // Weighted average
    const confidence = ratedBooksScore * 0.5 + totalBooksScore * 0.3 + activityScore * 0.2;

    return Math.round(confidence * 100) / 100;
  }
}
