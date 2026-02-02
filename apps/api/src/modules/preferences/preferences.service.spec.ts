import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesService } from './preferences.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_PREFERENCE_CONFIG } from './preferences.types';

describe('PreferencesService', () => {
  let service: PreferencesService;

  const mockPrismaService = {
    userBook: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    purchase: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
    jest.clearAllMocks();
  });

  describe('calculateBookWeight', () => {
    const now = Date.now();

    it('should give highest weight to recently read and highly rated books', () => {
      const recentHighRated = {
        status: 'READ',
        rating: 5,
        ratedAt: new Date(now - 1000 * 60 * 60 * 24), // 1 day ago
        updatedAt: new Date(now - 1000 * 60 * 60 * 24),
      };

      const weight = service.calculateBookWeight(recentHighRated, now);

      // Should be close to 1.0 (status=1.0, rating=1.0, recency≈1.0)
      expect(weight).toBeGreaterThan(0.9);
    });

    it('should give lower weight to old books', () => {
      const oldBook = {
        status: 'READ',
        rating: 5,
        ratedAt: new Date(now - 1000 * 60 * 60 * 24 * 365), // 1 year ago
        updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 365),
      };

      const weight = service.calculateBookWeight(oldBook, now);

      // Recency should significantly reduce weight
      expect(weight).toBeLessThan(0.3);
    });

    it('should give lower weight to low-rated books', () => {
      const lowRated = {
        status: 'READ',
        rating: 1,
        ratedAt: new Date(now - 1000 * 60 * 60 * 24), // 1 day ago
        updatedAt: new Date(now - 1000 * 60 * 60 * 24),
      };

      const weight = service.calculateBookWeight(lowRated, now);

      // Rating of 1/5 = 0.2
      expect(weight).toBeLessThan(0.3);
    });

    it('should give lower weight to want_to_read books', () => {
      const wantToRead = {
        status: 'WANT_TO_READ',
        rating: null,
        ratedAt: null,
        updatedAt: new Date(now - 1000 * 60 * 60 * 24),
      };

      const weight = service.calculateBookWeight(wantToRead, now);

      // Status weight is 0.3, no rating = 0.5
      expect(weight).toBeLessThan(0.2);
    });

    it('should use neutral rating weight when no rating', () => {
      const noRating = {
        status: 'READ',
        rating: null,
        ratedAt: null,
        updatedAt: new Date(now - 1000 * 60 * 60 * 24),
      };

      const weight = service.calculateBookWeight(noRating, now);

      // Status=1.0, rating=0.5 (neutral), recency≈1.0
      expect(weight).toBeGreaterThan(0.4);
      expect(weight).toBeLessThan(0.6);
    });

    it('should produce deterministic results', () => {
      const book = {
        status: 'READ',
        rating: 4,
        ratedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const fixedNow = new Date('2024-06-15').getTime();

      const weight1 = service.calculateBookWeight(book, fixedNow);
      const weight2 = service.calculateBookWeight(book, fixedNow);

      expect(weight1).toBe(weight2);
    });
  });

  describe('getCategoryAffinity', () => {
    it('should return empty array when user has no books', async () => {
      mockPrismaService.userBook.findMany.mockResolvedValue([]);

      const result = await service.getCategoryAffinity('user-123');

      expect(result).toEqual([]);
    });

    it('should return categories sorted by score descending', async () => {
      const now = Date.now();
      mockPrismaService.userBook.findMany.mockResolvedValue([
        {
          status: 'READ',
          rating: 5,
          ratedAt: new Date(now - 1000 * 60 * 60 * 24),
          updatedAt: new Date(now - 1000 * 60 * 60 * 24),
          book: {
            categories: [
              { category: { id: 'cat-1', name: 'Fantasy', slug: 'fantasy', parentId: null } },
            ],
          },
        },
        {
          status: 'WANT_TO_READ',
          rating: null,
          ratedAt: null,
          updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 30),
          book: {
            categories: [
              { category: { id: 'cat-2', name: 'Romance', slug: 'romance', parentId: null } },
            ],
          },
        },
      ]);

      const result = await service.getCategoryAffinity('user-123');

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Fantasy'); // Higher weight
      expect(result[0].score).toBe(1); // Normalized to max
      expect(result[1].name).toBe('Romance');
      expect(result[1].score).toBeLessThan(1);
    });

    it('should aggregate multiple books in same category', async () => {
      const now = Date.now();
      mockPrismaService.userBook.findMany.mockResolvedValue([
        {
          status: 'READ',
          rating: 5,
          ratedAt: new Date(now - 1000 * 60 * 60 * 24),
          updatedAt: new Date(now - 1000 * 60 * 60 * 24),
          book: {
            categories: [
              { category: { id: 'cat-1', name: 'Fantasy', slug: 'fantasy', parentId: null } },
            ],
          },
        },
        {
          status: 'READ',
          rating: 4,
          ratedAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
          updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 2),
          book: {
            categories: [
              { category: { id: 'cat-1', name: 'Fantasy', slug: 'fantasy', parentId: null } },
            ],
          },
        },
      ]);

      const result = await service.getCategoryAffinity('user-123');

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Fantasy');
      expect(result[0].sampleCount).toBe(2);
      expect(result[0].averageRating).toBe(4.5);
    });

    it('should normalize scores to 0..1 range', async () => {
      const now = Date.now();
      mockPrismaService.userBook.findMany.mockResolvedValue([
        {
          status: 'READ',
          rating: 5,
          ratedAt: new Date(now),
          updatedAt: new Date(now),
          book: {
            categories: [
              { category: { id: 'cat-1', name: 'Fantasy', slug: 'fantasy', parentId: null } },
            ],
          },
        },
      ]);

      const result = await service.getCategoryAffinity('user-123');

      expect(result[0].score).toBeGreaterThanOrEqual(0);
      expect(result[0].score).toBeLessThanOrEqual(1);
    });
  });

  describe('getFormatAffinity', () => {
    it('should combine bookshelf and purchase data', async () => {
      mockPrismaService.userBook.findMany.mockResolvedValue([
        { book: { hasPaper: true, hasEbook: true, hasAudiobook: false } },
        { book: { hasPaper: true, hasEbook: false, hasAudiobook: false } },
      ]);

      mockPrismaService.purchase.groupBy.mockResolvedValue([
        { format: 'EBOOK', _count: { format: 3 } },
      ]);

      const result = await service.getFormatAffinity('user-123');

      expect(result).toHaveLength(3);

      // Ebook should be highest (3 purchases * 2 + 1 bookshelf = 7)
      const ebook = result.find((f) => f.format === 'ebook');
      expect(ebook).toBeDefined();
      expect(ebook!.fromPurchases).toBe(3);
      expect(ebook!.fromBookshelf).toBe(1);

      // Paper should be second (2 bookshelf)
      const paper = result.find((f) => f.format === 'paper');
      expect(paper).toBeDefined();
      expect(paper!.fromBookshelf).toBe(2);
    });

    it('should weight purchases 2x over bookshelf', async () => {
      mockPrismaService.userBook.findMany.mockResolvedValue([
        { book: { hasPaper: true, hasEbook: false, hasAudiobook: false } },
        { book: { hasPaper: true, hasEbook: false, hasAudiobook: false } },
      ]);

      mockPrismaService.purchase.groupBy.mockResolvedValue([
        { format: 'EBOOK', _count: { format: 1 } },
      ]);

      const result = await service.getFormatAffinity('user-123');

      const paper = result.find((f) => f.format === 'paper');
      const ebook = result.find((f) => f.format === 'ebook');

      // Paper: 2 bookshelf = 2 total
      // Ebook: 1 purchase * 2 = 2 total
      expect(paper!.total).toBe(2);
      expect(ebook!.total).toBe(2);
    });
  });

  describe('getReadingStats', () => {
    it('should return correct status counts', async () => {
      mockPrismaService.userBook.groupBy.mockResolvedValueOnce([
        { status: 'WANT_TO_READ', _count: { status: 5 } },
        { status: 'READING', _count: { status: 2 } },
        { status: 'READ', _count: { status: 10 } },
      ]);

      mockPrismaService.userBook.aggregate.mockResolvedValue({
        _avg: { rating: 4.2 },
        _count: { rating: 8 },
      });

      mockPrismaService.userBook.groupBy.mockResolvedValueOnce([
        { rating: 5, _count: { rating: 3 } },
        { rating: 4, _count: { rating: 5 } },
      ]);

      mockPrismaService.userBook.count
        .mockResolvedValueOnce(3) // booksAdded
        .mockResolvedValueOnce(2) // booksRated
        .mockResolvedValueOnce(1); // booksFinished

      const result = await service.getReadingStats('user-123');

      expect(result.byStatus.wantToRead).toBe(5);
      expect(result.byStatus.reading).toBe(2);
      expect(result.byStatus.read).toBe(10);
      expect(result.totalBooks).toBe(17);
      expect(result.ratings.average).toBe(4.2);
      expect(result.ratings.count).toBe(8);
    });
  });
});
