import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReadingStatus } from '@prisma/client';
import {
  ReadingStatusDto,
  BookshelfItemDto,
  BookshelfListResponseDto,
  BookshelfStatsDto,
} from './dto/bookshelf.dto';

/**
 * Bookshelf Service
 *
 * Handles user bookshelf operations: status updates, ratings, and queries.
 *
 * Business rules:
 * - One UserBook record per (user, book) pair
 * - Rating (1-5) only allowed when status = READ
 * - Updating status does not erase rating
 * - Updating rating does not change status
 * - Timestamps updated accordingly
 */
@Injectable()
export class BookshelfService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert DTO status to Prisma enum
   */
  private toPrismaStatus(status: ReadingStatusDto): ReadingStatus {
    const mapping: Record<ReadingStatusDto, ReadingStatus> = {
      [ReadingStatusDto.WANT_TO_READ]: 'WANT_TO_READ',
      [ReadingStatusDto.READING]: 'READING',
      [ReadingStatusDto.READ]: 'READ',
    };
    return mapping[status];
  }

  /**
   * Convert Prisma enum to DTO status
   */
  private toDtoStatus(status: ReadingStatus): ReadingStatusDto {
    const mapping: Record<ReadingStatus, ReadingStatusDto> = {
      WANT_TO_READ: ReadingStatusDto.WANT_TO_READ,
      READING: ReadingStatusDto.READING,
      READ: ReadingStatusDto.READ,
    };
    return mapping[status];
  }

  /**
   * Validate that book exists in catalog
   */
  private async validateBookExists(bookId: string): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${bookId} not found`);
    }
  }

  /**
   * Update reading status for a book
   *
   * Rules:
   * - Upserts UserBook record
   * - Sets statusChangedAt to now
   * - If status becomes READING and startedAt is null -> sets startedAt
   * - If status becomes READ and finishedAt is null -> sets finishedAt
   * - Does NOT erase rating, ratedAt, or review
   */
  async updateStatus(
    userId: string,
    bookId: string,
    status: ReadingStatusDto,
  ): Promise<BookshelfItemDto> {
    await this.validateBookExists(bookId);

    const prismaStatus = this.toPrismaStatus(status);
    const now = new Date();

    // Check if record exists to determine additional updates
    const existing = await this.prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    // Build update data
    const updateData: any = {
      status: prismaStatus,
      statusChangedAt: now,
    };

    // Set startedAt when transitioning to READING (if not already set)
    if (prismaStatus === 'READING' && !existing?.startedAt) {
      updateData.startedAt = now;
    }

    // Set finishedAt when transitioning to READ (if not already set)
    if (prismaStatus === 'READ' && !existing?.finishedAt) {
      updateData.finishedAt = now;
    }

    // Upsert the record
    const userBook = await this.prisma.userBook.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: {
        userId,
        bookId,
        status: prismaStatus,
        statusChangedAt: now,
        startedAt: prismaStatus === 'READING' || prismaStatus === 'READ' ? now : null,
        finishedAt: prismaStatus === 'READ' ? now : null,
      },
      update: updateData,
      include: {
        book: {
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
          },
        },
      },
    });

    return this.mapToDto(userBook);
  }

  /**
   * Update rating for a book
   *
   * Rules:
   * - Rating only allowed when status = READ
   * - Sets ratedAt to now
   * - Does NOT change status, startedAt, finishedAt
   */
  async updateRating(
    userId: string,
    bookId: string,
    rating: number,
  ): Promise<BookshelfItemDto> {
    await this.validateBookExists(bookId);

    // Check if UserBook exists and has READ status
    const existing = await this.prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (!existing) {
      throw new BadRequestException(
        'You must add this book to your bookshelf before rating it',
      );
    }

    if (existing.status !== 'READ') {
      throw new BadRequestException(
        'You can only rate books that you have marked as read',
      );
    }

    // Update rating only
    const userBook = await this.prisma.userBook.update({
      where: { userId_bookId: { userId, bookId } },
      data: {
        rating,
        ratedAt: new Date(),
      },
      include: {
        book: {
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
          },
        },
      },
    });

    // Update book's aggregate rating
    await this.updateBookAggregateRating(bookId);

    return this.mapToDto(userBook);
  }

  /**
   * Get user's bookshelf with optional filtering
   */
  async getBookshelf(
    userId: string,
    options: {
      status?: ReadingStatusDto;
      limit?: number;
      cursor?: string;
    },
  ): Promise<BookshelfListResponseDto> {
    const limit = options.limit || 20;

    // Build where clause
    const where: any = { userId };
    if (options.status) {
      where.status = this.toPrismaStatus(options.status);
    }

    // Build cursor condition
    const cursorCondition = options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {};

    // Fetch items
    const [items, total] = await Promise.all([
      this.prisma.userBook.findMany({
        where,
        take: limit + 1, // Fetch one extra to check if there's more
        orderBy: { updatedAt: 'desc' },
        ...cursorCondition,
        include: {
          book: {
            include: {
              authors: { include: { author: true } },
              categories: { include: { category: true } },
            },
          },
        },
      }),
      this.prisma.userBook.count({ where }),
    ]);

    // Check if there are more items
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : undefined;

    return {
      items: resultItems.map((item) => this.mapToDto(item)),
      nextCursor,
      total,
    };
  }

  /**
   * Get a single bookshelf item
   */
  async getBookshelfItem(
    userId: string,
    bookId: string,
  ): Promise<BookshelfItemDto | null> {
    const userBook = await this.prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
      include: {
        book: {
          include: {
            authors: { include: { author: true } },
            categories: { include: { category: true } },
          },
        },
      },
    });

    if (!userBook) {
      return null;
    }

    return this.mapToDto(userBook);
  }

  /**
   * Get bookshelf statistics
   */
  async getStats(userId: string): Promise<BookshelfStatsDto> {
    const [statusCounts, ratingStats] = await Promise.all([
      this.prisma.userBook.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
      }),
      this.prisma.userBook.aggregate({
        where: { userId, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    // Initialize counts
    const byStatus = {
      want_to_read: 0,
      reading: 0,
      read: 0,
    };

    // Fill in counts
    for (const item of statusCounts) {
      const key = this.toDtoStatus(item.status);
      byStatus[key] = item._count.status;
    }

    const total = byStatus.want_to_read + byStatus.reading + byStatus.read;

    return {
      byStatus,
      total,
      averageRating: ratingStats._avg.rating
        ? Math.round(ratingStats._avg.rating * 10) / 10
        : undefined,
      ratedCount: ratingStats._count.rating,
    };
  }

  /**
   * Remove book from bookshelf
   */
  async removeFromBookshelf(userId: string, bookId: string): Promise<boolean> {
    const result = await this.prisma.userBook.deleteMany({
      where: { userId, bookId },
    });

    if (result.count > 0) {
      // Update book's aggregate rating after removal
      await this.updateBookAggregateRating(bookId);
    }

    return result.count > 0;
  }

  /**
   * Update book's aggregate rating based on all user ratings
   */
  private async updateBookAggregateRating(bookId: string): Promise<void> {
    const stats = await this.prisma.userBook.aggregate({
      where: { bookId, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        avgRating: stats._avg.rating || 0,
        ratingsCount: stats._count.rating,
      },
    });
  }

  /**
   * Map Prisma UserBook to DTO
   */
  private mapToDto(userBook: any): BookshelfItemDto {
    return {
      id: userBook.id,
      bookId: userBook.bookId,
      status: this.toDtoStatus(userBook.status),
      rating: userBook.rating || undefined,
      startedAt: userBook.startedAt || undefined,
      finishedAt: userBook.finishedAt || undefined,
      statusChangedAt: userBook.statusChangedAt || undefined,
      ratedAt: userBook.ratedAt || undefined,
      createdAt: userBook.createdAt,
      updatedAt: userBook.updatedAt,
      book: {
        id: userBook.book.id,
        title: userBook.book.title,
        coverUrl: userBook.book.coverUrl || undefined,
        authors: userBook.book.authors.map((a: any) => a.author.name),
        categories: userBook.book.categories.map((c: any) => c.category.name),
      },
    };
  }
}
