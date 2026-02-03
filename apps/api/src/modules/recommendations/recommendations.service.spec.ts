import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PreferencesService } from '../preferences/preferences.service';
import {
  RecommendedBook,
  DEFAULT_SCORING_WEIGHTS,
} from './recommendations.types';
import { UserPreferences } from '../preferences/preferences.types';

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  const mockPrismaService = {
    userBook: {
      findMany: jest.fn(),
    },
    book: {
      findMany: jest.fn(),
    },
  };

  const mockPreferencesService = {
    getUserPreferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PreferencesService, useValue: mockPreferencesService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
    jest.clearAllMocks();
  });

  describe('scoreBook', () => {
    const createMockBook = (overrides?: Partial<RecommendedBook>): RecommendedBook => ({
      id: 'book-1',
      title: 'Test Book',
      authors: ['Author A'],
      categories: ['Fantasy'],
      formats: { paper: true, ebook: false, audiobook: false },
      avgRating: 4.5,
      ratingsCount: 100,
      hasOffers: false,
      ...overrides,
    });

    const createMockPreferences = (overrides?: Partial<UserPreferences>): UserPreferences => ({
      userId: 'user-1',
      calculatedAt: new Date(),
      categories: [
        { id: 'cat-1', name: 'Fantasy', score: 0.9, sampleCount: 5, averageRating: 4.5 },
        { id: 'cat-2', name: 'Sci-Fi', score: 0.6, sampleCount: 3, averageRating: 4.0 },
      ],
      authors: [
        { id: 'auth-1', name: 'Author A', score: 0.8, sampleCount: 3, booksRead: 3 },
      ],
      formats: [
        { format: 'paper', score: 0.7, fromBookshelf: 5, fromPurchases: 3, total: 8 },
        { format: 'ebook', score: 0.5, fromBookshelf: 2, fromPurchases: 1, total: 3 },
        { format: 'audiobook', score: 0.2, fromBookshelf: 1, fromPurchases: 0, total: 1 },
      ],
      stats: {
        totalBooks: 10,
        byStatus: { wantToRead: 3, reading: 2, read: 5 },
        ratings: { count: 5, average: 4.2, distribution: { 4: 2, 5: 3 } },
        recentActivity: { booksAdded: 2, booksRated: 1, booksFinished: 1 },
      },
      negativeSignals: {
        categories: [],
        authors: [],
      },
      dataQuality: {
        hasEnoughData: true,
        confidence: 0.8,
        lastRatingAt: new Date(),
        lastActivityAt: new Date(),
      },
      ...overrides,
    });

    it('should calculate weighted score using formula', () => {
      const book = createMockBook();
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, true);

      // Verify score components
      expect(result.debug).toBeDefined();
      expect(result.debug!.categoryScore).toBe(0.9); // Fantasy match
      expect(result.debug!.authorScore).toBe(0.8); // Author A match
      expect(result.debug!.formatScore).toBe(0.7); // Paper match

      // Verify final score calculation
      const expectedScore =
        0.9 * DEFAULT_SCORING_WEIGHTS.category +
        0.8 * DEFAULT_SCORING_WEIGHTS.author +
        0.7 * DEFAULT_SCORING_WEIGHTS.format +
        result.debug!.popularityScore * DEFAULT_SCORING_WEIGHTS.popularity;

      expect(result.score).toBeCloseTo(expectedScore, 1);
    });

    it('should return zero category score when no category match', () => {
      const book = createMockBook({ categories: ['Horror'] });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, true);

      expect(result.debug!.categoryScore).toBe(0);
      expect(result.debug!.matchedCategories).toEqual([]);
    });

    it('should return zero author score when no author match', () => {
      const book = createMockBook({ authors: ['Unknown Author'] });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, true);

      expect(result.debug!.authorScore).toBe(0);
      expect(result.debug!.matchedAuthors).toEqual([]);
    });

    it('should add offer boost when book has offers', () => {
      const bookWithOffers = createMockBook({ hasOffers: true });
      const bookWithoutOffers = createMockBook({ hasOffers: false });
      const preferences = createMockPreferences();

      const withOffers = service.scoreBook(bookWithOffers, preferences, false);
      const withoutOffers = service.scoreBook(bookWithoutOffers, preferences, false);

      expect(withOffers.score).toBeGreaterThan(withoutOffers.score);
    });

    it('should generate reasons for matched preferences', () => {
      const book = createMockBook();
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, false);

      expect(result.reasons.length).toBeGreaterThan(0);
      // Should have category reason
      expect(result.reasons.some((r) => r.includes('Fantasy'))).toBe(true);
      // Should have author reason
      expect(result.reasons.some((r) => r.includes('Author A'))).toBe(true);
    });

    it('should include format reason when preferred format available', () => {
      const book = createMockBook({ formats: { paper: true, ebook: false, audiobook: false } });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, false);

      expect(result.reasons.some((r) => r.includes('paper'))).toBe(true);
    });

    it('should include popularity reason for highly rated books', () => {
      const book = createMockBook({ avgRating: 4.5, ratingsCount: 100 });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, false);

      expect(result.reasons.some((r) => r.includes('Highly rated'))).toBe(true);
    });

    it('should not include popularity reason for low-rated books', () => {
      const book = createMockBook({ avgRating: 3.0, ratingsCount: 5 });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, false);

      expect(result.reasons.some((r) => r.includes('Highly rated'))).toBe(false);
    });

    it('should normalize score to 0-1 range', () => {
      const book = createMockBook({ hasOffers: true });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, false);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should produce deterministic results', () => {
      const book = createMockBook();
      const preferences = createMockPreferences();

      const result1 = service.scoreBook(book, preferences, true);
      const result2 = service.scoreBook(book, preferences, true);

      expect(result1.score).toBe(result2.score);
      expect(result1.debug).toEqual(result2.debug);
    });

    it('should pick highest affinity when book has multiple matching categories', () => {
      const book = createMockBook({ categories: ['Fantasy', 'Sci-Fi'] });
      const preferences = createMockPreferences();

      const result = service.scoreBook(book, preferences, true);

      // Should use Fantasy (0.9) not Sci-Fi (0.6)
      expect(result.debug!.categoryScore).toBe(0.9);
      expect(result.debug!.matchedCategories).toContain('Fantasy');
      expect(result.debug!.matchedCategories).toContain('Sci-Fi');
    });
  });

  describe('calculatePopularityScore', () => {
    it('should return higher score for highly rated books', () => {
      const highRated = { avgRating: 5.0, ratingsCount: 100 } as RecommendedBook;
      const lowRated = { avgRating: 2.0, ratingsCount: 100 } as RecommendedBook;

      // Access private method through any
      const highScore = (service as any).calculatePopularityScore(highRated);
      const lowScore = (service as any).calculatePopularityScore(lowRated);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should factor in ratings count', () => {
      const manyRatings = { avgRating: 4.0, ratingsCount: 1000 } as RecommendedBook;
      const fewRatings = { avgRating: 4.0, ratingsCount: 5 } as RecommendedBook;

      const manyScore = (service as any).calculatePopularityScore(manyRatings);
      const fewScore = (service as any).calculatePopularityScore(fewRatings);

      expect(manyScore).toBeGreaterThan(fewScore);
    });

    it('should return neutral score for unrated books', () => {
      const unrated = { avgRating: 0, ratingsCount: 0 } as RecommendedBook;

      const score = (service as any).calculatePopularityScore(unrated);

      expect(score).toBe(0.3); // Neutral default
    });
  });

  describe('getRecommendations', () => {
    it('should use fallback when user has insufficient data', async () => {
      mockPreferencesService.getUserPreferences.mockResolvedValue({
        userId: 'user-1',
        dataQuality: {
          hasEnoughData: false,
          confidence: 0.1,
        },
        categories: [],
        authors: [],
        formats: [],
        negativeSignals: { categories: [], authors: [] },
        stats: { totalBooks: 0, byStatus: {}, ratings: {}, recentActivity: {} },
      });

      mockPrismaService.book.findMany.mockResolvedValue([
        {
          id: 'pop-1',
          title: 'Popular Book',
          isbn: null,
          coverUrl: null,
          description: null,
          hasPaper: true,
          hasEbook: false,
          hasAudiobook: false,
          avgRating: 4.5,
          ratingsCount: 500,
          authors: [{ author: { name: 'Famous Author' } }],
          categories: [{ category: { name: 'Fiction' } }],
          offers: [],
        },
      ]);

      const result = await service.getRecommendations('user-1', { limit: 5 });

      expect(result.meta.fallbackUsed).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should exclude already read books', async () => {
      mockPreferencesService.getUserPreferences.mockResolvedValue({
        userId: 'user-1',
        dataQuality: { hasEnoughData: true, confidence: 0.8 },
        categories: [{ id: 'c1', name: 'Fantasy', score: 0.9, sampleCount: 5 }],
        authors: [],
        formats: [{ format: 'paper', score: 0.5, total: 5 }],
        negativeSignals: { categories: [], authors: [] },
        stats: { totalBooks: 5, byStatus: { read: 5 }, ratings: {}, recentActivity: {} },
      });

      // User has read book-1
      mockPrismaService.userBook.findMany.mockResolvedValue([
        { bookId: 'book-1' },
      ]);

      // Catalog has book-1 and book-2
      mockPrismaService.book.findMany.mockResolvedValue([
        {
          id: 'book-1', // Should be excluded
          title: 'Already Read',
          isbn: null,
          coverUrl: null,
          description: null,
          hasPaper: true,
          hasEbook: false,
          hasAudiobook: false,
          avgRating: 4.0,
          ratingsCount: 50,
          authors: [{ author: { name: 'Author' } }],
          categories: [{ category: { name: 'Fantasy' } }],
          offers: [],
        },
        {
          id: 'book-2', // Should be included
          title: 'New Book',
          isbn: null,
          coverUrl: null,
          description: null,
          hasPaper: true,
          hasEbook: false,
          hasAudiobook: false,
          avgRating: 4.5,
          ratingsCount: 100,
          authors: [{ author: { name: 'Author' } }],
          categories: [{ category: { name: 'Fantasy' } }],
          offers: [],
        },
      ]);

      const result = await service.getRecommendations('user-1', {});

      expect(result.meta.excluded).toBe(1);
      expect(result.items.some((i) => i.book.id === 'book-1')).toBe(false);
      expect(result.items.some((i) => i.book.id === 'book-2')).toBe(true);
    });

    it('should return items sorted by score descending', async () => {
      mockPreferencesService.getUserPreferences.mockResolvedValue({
        userId: 'user-1',
        dataQuality: { hasEnoughData: true, confidence: 0.8 },
        categories: [{ id: 'c1', name: 'Fantasy', score: 0.9, sampleCount: 5 }],
        authors: [],
        formats: [{ format: 'paper', score: 0.5, total: 5 }],
        negativeSignals: { categories: [], authors: [] },
        stats: { totalBooks: 5, byStatus: { read: 5 }, ratings: {}, recentActivity: {} },
      });

      mockPrismaService.userBook.findMany.mockResolvedValue([]);
      mockPrismaService.book.findMany.mockResolvedValue([
        {
          id: 'book-low',
          title: 'Low Score',
          isbn: null,
          coverUrl: null,
          description: null,
          hasPaper: true,
          hasEbook: false,
          hasAudiobook: false,
          avgRating: 3.0,
          ratingsCount: 10,
          authors: [{ author: { name: 'Unknown' } }],
          categories: [{ category: { name: 'Other' } }],
          offers: [],
        },
        {
          id: 'book-high',
          title: 'High Score',
          isbn: null,
          coverUrl: null,
          description: null,
          hasPaper: true,
          hasEbook: false,
          hasAudiobook: false,
          avgRating: 4.8,
          ratingsCount: 200,
          authors: [{ author: { name: 'Author' } }],
          categories: [{ category: { name: 'Fantasy' } }],
          offers: [],
        },
      ]);

      const result = await service.getRecommendations('user-1', {});

      expect(result.items[0].book.id).toBe('book-high');
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1].score).toBeGreaterThanOrEqual(result.items[i].score);
      }
    });

    it('should respect limit parameter', async () => {
      mockPreferencesService.getUserPreferences.mockResolvedValue({
        userId: 'user-1',
        dataQuality: { hasEnoughData: false, confidence: 0.1 },
        categories: [],
        authors: [],
        formats: [],
        negativeSignals: { categories: [], authors: [] },
        stats: { totalBooks: 0, byStatus: {}, ratings: {}, recentActivity: {} },
      });

      mockPrismaService.book.findMany.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          id: `book-${i}`,
          title: `Book ${i}`,
          isbn: null,
          coverUrl: null,
          description: null,
          hasPaper: true,
          hasEbook: false,
          hasAudiobook: false,
          avgRating: 4.0,
          ratingsCount: 100,
          authors: [{ author: { name: 'Author' } }],
          categories: [{ category: { name: 'Fiction' } }],
          offers: [],
        })),
      );

      const result = await service.getRecommendations('user-1', { limit: 5 });

      expect(result.items.length).toBe(5);
    });
  });
});
