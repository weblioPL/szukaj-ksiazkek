import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RecommendationsExplainService } from './recommendations-explain.service';
import { RecommendationsService } from './recommendations.service';
import { PreferencesService } from '../preferences/preferences.service';
import { ClaudeClient } from '../claude/claude.client';
import { PromptService } from '../claude/prompt.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AllowedBooksContext } from './recommendations-explain.types';

describe('RecommendationsExplainService', () => {
  let service: RecommendationsExplainService;

  const mockPrismaService = {
    book: {
      findUnique: jest.fn(),
    },
  };

  const mockClaudeClient = {
    isConfigured: jest.fn(),
    client: {
      messages: {
        create: jest.fn(),
      },
    },
  };

  const mockPromptService = {
    getExplainSystemPrompt: jest.fn(),
    buildExplainPrompt: jest.fn(),
    getCompareSystemPrompt: jest.fn(),
    buildComparePrompt: jest.fn(),
  };

  const mockPreferencesService = {
    getUserPreferences: jest.fn(),
  };

  const mockRecommendationsService = {
    getRecommendations: jest.fn(),
    scoreBook: jest.fn(),
  };

  const mockUserPreferences = {
    userId: 'user-1',
    calculatedAt: new Date(),
    categories: [
      { id: 'cat-1', name: 'Fantasy', score: 0.9, sampleCount: 5, averageRating: 4.5 },
    ],
    authors: [
      { id: 'auth-1', name: 'Author A', score: 0.8, sampleCount: 3, booksRead: 3 },
    ],
    formats: [
      { format: 'paper', score: 0.7, fromBookshelf: 5, fromPurchases: 3, total: 8 },
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
  };

  const mockBook = {
    id: 'book-1',
    isbn: '978-123',
    title: 'Test Book',
    coverUrl: 'http://example.com/cover.jpg',
    description: 'A test book description',
    hasPaper: true,
    hasEbook: false,
    hasAudiobook: false,
    avgRating: 4.5,
    ratingsCount: 100,
    authors: [{ author: { name: 'Author A' } }],
    categories: [{ category: { name: 'Fantasy' } }],
    offers: [{ id: 'offer-1' }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsExplainService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClaudeClient, useValue: mockClaudeClient },
        { provide: PromptService, useValue: mockPromptService },
        { provide: PreferencesService, useValue: mockPreferencesService },
        { provide: RecommendationsService, useValue: mockRecommendationsService },
      ],
    }).compile();

    service = module.get<RecommendationsExplainService>(RecommendationsExplainService);
    jest.clearAllMocks();
  });

  describe('validateBookInCatalog', () => {
    it('should pass when book ID is in allowed list', () => {
      const allowedContext: AllowedBooksContext = {
        allowedIds: new Set(['book-1', 'book-2', 'book-3']),
        idToTitle: new Map([
          ['book-1', 'Book One'],
          ['book-2', 'Book Two'],
          ['book-3', 'Book Three'],
        ]),
      };

      const result = service.validateBookInCatalog('book-1', allowedContext);

      expect(result.passed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when book ID is not in allowed list', () => {
      const allowedContext: AllowedBooksContext = {
        allowedIds: new Set(['book-1', 'book-2']),
        idToTitle: new Map([
          ['book-1', 'Book One'],
          ['book-2', 'Book Two'],
        ]),
      };

      const result = service.validateBookInCatalog('book-999', allowedContext);

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Book not in catalog');
      expect(result.suggestedResponse).toContain('wyszukiwarki');
    });

    it('should refuse non-catalog books with Polish message', () => {
      const allowedContext: AllowedBooksContext = {
        allowedIds: new Set(['book-1']),
        idToTitle: new Map([['book-1', 'Book One']]),
      };

      const result = service.validateBookInCatalog('invented-book-id', allowedContext);

      expect(result.passed).toBe(false);
      expect(result.suggestedResponse).toMatch(/nie mam|wyszukiwark/i);
    });
  });

  describe('explain', () => {
    beforeEach(() => {
      mockPrismaService.book.findUnique.mockResolvedValue(mockBook);
      mockPreferencesService.getUserPreferences.mockResolvedValue(mockUserPreferences);
      mockRecommendationsService.scoreBook.mockReturnValue({
        book: {
          id: 'book-1',
          title: 'Test Book',
          authors: ['Author A'],
          categories: ['Fantasy'],
          formats: { paper: true, ebook: false, audiobook: false },
          avgRating: 4.5,
          ratingsCount: 100,
          hasOffers: true,
        },
        score: 0.85,
        reasons: ['You enjoy Fantasy books', 'Available in your preferred format (paper)'],
        debug: {
          categoryScore: 0.9,
          authorScore: 0.8,
          formatScore: 0.7,
          popularityScore: 0.6,
          matchedCategories: ['Fantasy'],
          matchedAuthors: ['Author A'],
          matchedFormat: 'paper',
        },
      });
      mockRecommendationsService.getRecommendations.mockResolvedValue({
        items: [
          {
            book: { id: 'book-2', title: 'Alternative Book', authors: ['Author B'], categories: ['Fantasy'] },
            score: 0.75,
          },
        ],
        meta: { confidence: 0.8, fallbackUsed: false },
      });
    });

    it('should throw NotFoundException when book does not exist', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue(null);

      await expect(
        service.explain('user-1', { bookId: 'non-existent-book' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return explanation with only catalog book IDs', async () => {
      mockClaudeClient.isConfigured.mockReturnValue(false); // Use fallback

      const result = await service.explain('user-1', { bookId: 'book-1' });

      expect(result.bookId).toBe('book-1');
      expect(result.explanation).toBeDefined();
      expect(result.reasons).toContain('You enjoy Fantasy books');
      expect(result.confidence).toBe(0.8);

      // Verify alternatives are from catalog
      if (result.alternatives) {
        for (const alt of result.alternatives) {
          expect(alt.id).toBe('book-2'); // Only book-2 was in recommendations
        }
      }
    });

    it('should use fallback when Claude is not configured', async () => {
      mockClaudeClient.isConfigured.mockReturnValue(false);

      const result = await service.explain('user-1', { bookId: 'book-1' });

      expect(result.explanation).toContain('Polecamy');
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should include user question in context when provided', async () => {
      mockClaudeClient.isConfigured.mockReturnValue(false);

      const result = await service.explain('user-1', {
        bookId: 'book-1',
        context: 'Dlaczego ta książka?',
      });

      expect(result.bookId).toBe('book-1');
      expect(result.explanation).toBeDefined();
    });
  });

  describe('compare', () => {
    beforeEach(() => {
      mockPrismaService.book.findUnique
        .mockResolvedValueOnce(mockBook)
        .mockResolvedValueOnce({
          ...mockBook,
          id: 'book-2',
          title: 'Second Book',
        });
      mockPreferencesService.getUserPreferences.mockResolvedValue(mockUserPreferences);
      mockRecommendationsService.scoreBook
        .mockReturnValueOnce({
          book: { id: 'book-1', title: 'Test Book', authors: ['Author A'] },
          score: 0.85,
          reasons: [],
          debug: { categoryScore: 0.9, authorScore: 0.8 },
        })
        .mockReturnValueOnce({
          book: { id: 'book-2', title: 'Second Book', authors: ['Author B'] },
          score: 0.65,
          reasons: [],
          debug: { categoryScore: 0.5, authorScore: 0.3 },
        });
    });

    it('should throw BadRequestException when less than 2 books', async () => {
      await expect(
        service.compare('user-1', { bookIds: ['book-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when more than 5 books', async () => {
      await expect(
        service.compare('user-1', {
          bookIds: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when book not in catalog', async () => {
      mockPrismaService.book.findUnique.mockReset();
      mockPrismaService.book.findUnique
        .mockResolvedValueOnce(mockBook)
        .mockResolvedValueOnce(null); // Second book not found

      await expect(
        service.compare('user-1', { bookIds: ['book-1', 'book-missing'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return comparison with best fit ID from catalog only', async () => {
      mockClaudeClient.isConfigured.mockReturnValue(false);

      const result = await service.compare('user-1', {
        bookIds: ['book-1', 'book-2'],
      });

      expect(result.books.length).toBe(2);
      expect(result.bestFitId).toBe('book-1'); // Higher score
      expect(result.comparison).toBeDefined();

      // Verify all returned book IDs are from the request
      const requestedIds = new Set(['book-1', 'book-2']);
      for (const book of result.books) {
        expect(requestedIds.has(book.id)).toBe(true);
      }
    });

    it('should sort books by score in response', async () => {
      mockClaudeClient.isConfigured.mockReturnValue(false);

      const result = await service.compare('user-1', {
        bookIds: ['book-1', 'book-2'],
      });

      // Best fit should have highest score
      expect(result.bestFitId).toBe('book-1');
      expect(result.bestFitReason).toContain('85%');
    });
  });

  describe('extractAlternatives (guardrails)', () => {
    it('should only extract IDs that exist in candidates', () => {
      const candidates = [
        { id: 'allowed-1', title: 'Allowed Book 1', authors: ['A'], categories: ['C'], score: 0.8 },
        { id: 'allowed-2', title: 'Allowed Book 2', authors: ['B'], categories: ['D'], score: 0.7 },
      ];

      // Access private method through any
      const response = 'Sprawdź też: [ID:allowed-1] oraz [ID:invented-book] i [ID:allowed-2]';
      const alternatives = (service as any).extractAlternatives(response, candidates);

      expect(alternatives.length).toBe(2);
      expect(alternatives.map((a: any) => a.id)).toContain('allowed-1');
      expect(alternatives.map((a: any) => a.id)).toContain('allowed-2');
      expect(alternatives.map((a: any) => a.id)).not.toContain('invented-book');
    });

    it('should limit alternatives to 3', () => {
      const candidates = [
        { id: 'book-1', title: 'Book 1', authors: ['A'], categories: ['C'], score: 0.9 },
        { id: 'book-2', title: 'Book 2', authors: ['A'], categories: ['C'], score: 0.8 },
        { id: 'book-3', title: 'Book 3', authors: ['A'], categories: ['C'], score: 0.7 },
        { id: 'book-4', title: 'Book 4', authors: ['A'], categories: ['C'], score: 0.6 },
        { id: 'book-5', title: 'Book 5', authors: ['A'], categories: ['C'], score: 0.5 },
      ];

      const response = '[ID:book-1] [ID:book-2] [ID:book-3] [ID:book-4] [ID:book-5]';
      const alternatives = (service as any).extractAlternatives(response, candidates);

      expect(alternatives.length).toBe(3);
    });

    it('should not duplicate IDs in alternatives', () => {
      const candidates = [
        { id: 'book-1', title: 'Book 1', authors: ['A'], categories: ['C'], score: 0.9 },
      ];

      const response = 'Polecam [ID:book-1] bo jest świetna. Też [ID:book-1] jest fajna.';
      const alternatives = (service as any).extractAlternatives(response, candidates);

      expect(alternatives.length).toBe(1);
    });

    it('should return empty array when no matches', () => {
      const candidates = [
        { id: 'allowed-1', title: 'Allowed Book', authors: ['A'], categories: ['C'], score: 0.8 },
      ];

      const response = 'Polecam [ID:invented-book-1] i [ID:invented-book-2]';
      const alternatives = (service as any).extractAlternatives(response, candidates);

      expect(alternatives.length).toBe(0);
    });
  });

  describe('guardrails integration', () => {
    it('should never return book IDs not from catalog in explain response', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue(mockBook);
      mockPreferencesService.getUserPreferences.mockResolvedValue(mockUserPreferences);
      mockRecommendationsService.scoreBook.mockReturnValue({
        book: { id: 'book-1', title: 'Test Book', authors: ['Author A'] },
        score: 0.85,
        reasons: ['Test reason'],
        debug: { categoryScore: 0.9 },
      });
      mockRecommendationsService.getRecommendations.mockResolvedValue({
        items: [
          { book: { id: 'catalog-book-1', title: 'Catalog Book 1', authors: ['A'], categories: ['C'] }, score: 0.7 },
          { book: { id: 'catalog-book-2', title: 'Catalog Book 2', authors: ['B'], categories: ['D'] }, score: 0.6 },
        ],
        meta: { confidence: 0.8 },
      });
      mockClaudeClient.isConfigured.mockReturnValue(false);

      const result = await service.explain('user-1', { bookId: 'book-1' });

      // Main book ID must be the requested one
      expect(result.bookId).toBe('book-1');

      // All alternative IDs must be from catalog
      if (result.alternatives) {
        const catalogIds = new Set(['catalog-book-1', 'catalog-book-2']);
        for (const alt of result.alternatives) {
          expect(catalogIds.has(alt.id)).toBe(true);
        }
      }
    });

    it('should never return book IDs not from request in compare response', async () => {
      const book1 = { ...mockBook, id: 'request-book-1' };
      const book2 = { ...mockBook, id: 'request-book-2', title: 'Second' };

      mockPrismaService.book.findUnique
        .mockResolvedValueOnce(book1)
        .mockResolvedValueOnce(book2);
      mockPreferencesService.getUserPreferences.mockResolvedValue(mockUserPreferences);
      mockRecommendationsService.scoreBook
        .mockReturnValueOnce({ book: { id: 'request-book-1' }, score: 0.8, debug: {} })
        .mockReturnValueOnce({ book: { id: 'request-book-2' }, score: 0.7, debug: {} });
      mockClaudeClient.isConfigured.mockReturnValue(false);

      const result = await service.compare('user-1', {
        bookIds: ['request-book-1', 'request-book-2'],
      });

      const requestedIds = new Set(['request-book-1', 'request-book-2']);

      // All returned book IDs must be from request
      for (const book of result.books) {
        expect(requestedIds.has(book.id)).toBe(true);
      }

      // Best fit must be from request
      if (result.bestFitId) {
        expect(requestedIds.has(result.bestFitId)).toBe(true);
      }
    });
  });
});
