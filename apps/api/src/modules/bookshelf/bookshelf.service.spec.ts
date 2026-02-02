import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookshelfService } from './bookshelf.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReadingStatusDto } from './dto/bookshelf.dto';

describe('BookshelfService', () => {
  let service: BookshelfService;
  let prisma: PrismaService;

  const mockPrismaService = {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userBook: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockBook = {
    id: 'book-123',
    title: 'Test Book',
    coverUrl: 'https://example.com/cover.jpg',
    authors: [{ author: { name: 'Test Author' } }],
    categories: [{ category: { name: 'Fiction' } }],
  };

  const mockUserBook = {
    id: 'userbook-123',
    userId: 'user-123',
    bookId: 'book-123',
    status: 'WANT_TO_READ',
    rating: null,
    review: null,
    startedAt: null,
    finishedAt: null,
    statusChangedAt: new Date(),
    ratedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    book: mockBook,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookshelfService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BookshelfService>(BookshelfService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('updateStatus', () => {
    it('should create a new bookshelf entry when book not in bookshelf', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(null);
      mockPrismaService.userBook.upsert.mockResolvedValue(mockUserBook);

      const result = await service.updateStatus(
        'user-123',
        'book-123',
        ReadingStatusDto.WANT_TO_READ,
      );

      expect(result.status).toBe(ReadingStatusDto.WANT_TO_READ);
      expect(mockPrismaService.userBook.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundException when book does not exist', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('user-123', 'book-123', ReadingStatusDto.READING),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set startedAt when status becomes READING', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(null);
      mockPrismaService.userBook.upsert.mockResolvedValue({
        ...mockUserBook,
        status: 'READING',
        startedAt: new Date(),
      });

      const result = await service.updateStatus(
        'user-123',
        'book-123',
        ReadingStatusDto.READING,
      );

      expect(result.status).toBe(ReadingStatusDto.READING);
      expect(result.startedAt).toBeDefined();
    });

    it('should set finishedAt when status becomes READ', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(null);
      mockPrismaService.userBook.upsert.mockResolvedValue({
        ...mockUserBook,
        status: 'READ',
        startedAt: new Date(),
        finishedAt: new Date(),
      });

      const result = await service.updateStatus(
        'user-123',
        'book-123',
        ReadingStatusDto.READ,
      );

      expect(result.status).toBe(ReadingStatusDto.READ);
      expect(result.finishedAt).toBeDefined();
    });

    it('should not erase existing rating when updating status', async () => {
      const existingWithRating = {
        ...mockUserBook,
        status: 'READ',
        rating: 5,
        ratedAt: new Date(),
      };
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(existingWithRating);
      mockPrismaService.userBook.upsert.mockResolvedValue({
        ...existingWithRating,
        status: 'READING', // Status changed but rating preserved
      });

      // The upsert call should NOT include rating in update data
      await service.updateStatus(
        'user-123',
        'book-123',
        ReadingStatusDto.READING,
      );

      const upsertCall = mockPrismaService.userBook.upsert.mock.calls[0][0];
      expect(upsertCall.update.rating).toBeUndefined();
    });
  });

  describe('updateRating', () => {
    it('should update rating when status is READ', async () => {
      const readBook = { ...mockUserBook, status: 'READ' };
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(readBook);
      mockPrismaService.userBook.update.mockResolvedValue({
        ...readBook,
        rating: 4,
        ratedAt: new Date(),
      });
      mockPrismaService.userBook.aggregate.mockResolvedValue({
        _avg: { rating: 4 },
        _count: { rating: 1 },
      });

      const result = await service.updateRating('user-123', 'book-123', 4);

      expect(result.rating).toBe(4);
      expect(result.ratedAt).toBeDefined();
    });

    it('should throw BadRequestException when book not in bookshelf', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRating('user-123', 'book-123', 4),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when status is not READ', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue({
        ...mockUserBook,
        status: 'READING',
      });

      await expect(
        service.updateRating('user-123', 'book-123', 4),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateRating('user-123', 'book-123', 4),
      ).rejects.toThrow('You can only rate books that you have marked as read');
    });

    it('should throw BadRequestException when status is WANT_TO_READ', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue({
        ...mockUserBook,
        status: 'WANT_TO_READ',
      });

      await expect(
        service.updateRating('user-123', 'book-123', 4),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when book does not exist in catalog', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRating('user-123', 'book-123', 4),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not change status when updating rating', async () => {
      const readBook = { ...mockUserBook, status: 'READ' };
      mockPrismaService.book.findUnique.mockResolvedValue({ id: 'book-123' });
      mockPrismaService.userBook.findUnique.mockResolvedValue(readBook);
      mockPrismaService.userBook.update.mockResolvedValue({
        ...readBook,
        rating: 5,
        ratedAt: new Date(),
      });
      mockPrismaService.userBook.aggregate.mockResolvedValue({
        _avg: { rating: 5 },
        _count: { rating: 1 },
      });

      await service.updateRating('user-123', 'book-123', 5);

      const updateCall = mockPrismaService.userBook.update.mock.calls[0][0];
      expect(updateCall.data.status).toBeUndefined();
      expect(updateCall.data.startedAt).toBeUndefined();
      expect(updateCall.data.finishedAt).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      mockPrismaService.userBook.groupBy.mockResolvedValue([
        { status: 'WANT_TO_READ', _count: { status: 5 } },
        { status: 'READING', _count: { status: 2 } },
        { status: 'READ', _count: { status: 10 } },
      ]);
      mockPrismaService.userBook.aggregate.mockResolvedValue({
        _avg: { rating: 4.2 },
        _count: { rating: 8 },
      });

      const result = await service.getStats('user-123');

      expect(result.byStatus.want_to_read).toBe(5);
      expect(result.byStatus.reading).toBe(2);
      expect(result.byStatus.read).toBe(10);
      expect(result.total).toBe(17);
      expect(result.averageRating).toBe(4.2);
      expect(result.ratedCount).toBe(8);
    });
  });
});
