import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface FindAllParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  format?: string;
  sort?: 'relevance' | 'title' | 'rating' | 'newest';
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all books with filtering, pagination, and full-text search
   */
  async findAll(params: FindAllParams) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      format,
      sort = 'relevance',
    } = params;

    // Use full-text search if search query is provided
    if (search && search.trim().length > 0) {
      return this.searchBooks(search.trim(), { page, limit, category, format, sort });
    }

    // Otherwise, use standard filtering
    return this.browseBooks({ page, limit, category, format, sort });
  }

  /**
   * Full-text search using PostgreSQL
   */
  private async searchBooks(
    query: string,
    options: {
      page: number;
      limit: number;
      category?: string;
      format?: string;
      sort: string;
    },
  ) {
    const { page, limit, category, format, sort } = options;
    const offset = (page - 1) * limit;

    try {
      // Use raw query for full-text search with ranking
      const searchResults = await this.prisma.$queryRaw<
        { book_id: string; rank: number }[]
      >`
        SELECT DISTINCT
          b.id AS book_id,
          ts_rank(
            COALESCE(b.search_vector, to_tsvector('simple', '')),
            plainto_tsquery('simple', ${query})
          ) +
          CASE WHEN EXISTS (
            SELECT 1 FROM book_authors ba2
            JOIN authors a2 ON ba2.author_id = a2.id
            WHERE ba2.book_id = b.id AND a2.name ILIKE ${'%' + query + '%'}
          ) THEN 0.5 ELSE 0 END AS rank
        FROM books b
        LEFT JOIN book_categories bc ON b.id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.id
        WHERE
          (
            b.search_vector @@ plainto_tsquery('simple', ${query})
            OR EXISTS (
              SELECT 1 FROM book_authors ba
              JOIN authors a ON ba.author_id = a.id
              WHERE ba.book_id = b.id AND a.name ILIKE ${'%' + query + '%'}
            )
            OR b.isbn = ${query}
            OR b.ean = ${query}
            OR b.title ILIKE ${'%' + query + '%'}
          )
          ${category ? Prisma.sql`AND c.slug = ${category}` : Prisma.empty}
          ${format === 'paper' ? Prisma.sql`AND b.has_paper = true` : Prisma.empty}
          ${format === 'ebook' ? Prisma.sql`AND b.has_ebook = true` : Prisma.empty}
          ${format === 'audiobook' ? Prisma.sql`AND b.has_audiobook = true` : Prisma.empty}
        ORDER BY rank DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const bookIds = searchResults.map((r) => r.book_id);

      if (bookIds.length === 0) {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      // Get full book data
      const books = await this.prisma.book.findMany({
        where: { id: { in: bookIds } },
        include: {
          authors: {
            include: { author: true },
            orderBy: { displayOrder: 'asc' },
          },
          categories: {
            include: { category: true },
          },
        },
      });

      // Sort books by search rank
      const rankMap = new Map(searchResults.map((r) => [r.book_id, r.rank]));
      books.sort((a, b) => (rankMap.get(b.id) || 0) - (rankMap.get(a.id) || 0));

      // Get total count for pagination
      const countResult = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT b.id) as count
        FROM books b
        LEFT JOIN book_categories bc ON b.id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.id
        WHERE
          (
            b.search_vector @@ plainto_tsquery('simple', ${query})
            OR EXISTS (
              SELECT 1 FROM book_authors ba
              JOIN authors a ON ba.author_id = a.id
              WHERE ba.book_id = b.id AND a.name ILIKE ${'%' + query + '%'}
            )
            OR b.isbn = ${query}
            OR b.ean = ${query}
            OR b.title ILIKE ${'%' + query + '%'}
          )
          ${category ? Prisma.sql`AND c.slug = ${category}` : Prisma.empty}
          ${format === 'paper' ? Prisma.sql`AND b.has_paper = true` : Prisma.empty}
          ${format === 'ebook' ? Prisma.sql`AND b.has_ebook = true` : Prisma.empty}
          ${format === 'audiobook' ? Prisma.sql`AND b.has_audiobook = true` : Prisma.empty}
      `;

      const total = Number(countResult[0]?.count || 0);

      return {
        data: this.formatBooks(books),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Full-text search failed: ${error}`);
      // Fall back to simple ILIKE search
      return this.browseBooks({
        page,
        limit,
        category,
        format,
        sort: 'relevance',
        search: query,
      });
    }
  }

  /**
   * Browse books without search (category/format filtering only)
   */
  private async browseBooks(options: {
    page: number;
    limit: number;
    category?: string;
    format?: string;
    sort: string;
    search?: string;
  }) {
    const { page, limit, category, format, sort, search } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.BookWhereInput = {};

    // Simple text search fallback
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { isbn: search },
        { ean: search },
      ];
    }

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      };
    }

    if (format) {
      const formatMap: Record<string, keyof Prisma.BookWhereInput> = {
        paper: 'hasPaper',
        ebook: 'hasEbook',
        audiobook: 'hasAudiobook',
      };
      if (formatMap[format]) {
        where[formatMap[format]] = true;
      }
    }

    // Build order by
    let orderBy: Prisma.BookOrderByWithRelationInput = { createdAt: 'desc' };
    switch (sort) {
      case 'title':
        orderBy = { title: 'asc' };
        break;
      case 'rating':
        orderBy = { avgRating: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        skip,
        take: limit,
        include: {
          authors: {
            include: { author: true },
            orderBy: { displayOrder: 'asc' },
          },
          categories: {
            include: { category: true },
          },
        },
        orderBy,
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      data: this.formatBooks(books),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find book by ID with all details
   */
  async findById(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        authors: {
          include: { author: true },
          orderBy: { displayOrder: 'asc' },
        },
        categories: {
          include: { category: true },
        },
      },
    });

    if (!book) {
      return null;
    }

    return this.formatBook(book);
  }

  /**
   * Find book by ISBN or EAN
   */
  async findByIsbn(isbn: string) {
    const book = await this.prisma.book.findFirst({
      where: {
        OR: [{ isbn }, { ean: isbn }],
      },
      include: {
        authors: {
          include: { author: true },
          orderBy: { displayOrder: 'asc' },
        },
        categories: {
          include: { category: true },
        },
      },
    });

    if (!book) {
      return null;
    }

    return this.formatBook(book);
  }

  /**
   * Get all categories with hierarchy
   */
  async getCategories() {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { books: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      data: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        bookCount: cat._count.books,
        children: cat.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          description: child.description,
        })),
      })),
    };
  }

  /**
   * Get books by category
   */
  async getBooksByCategory(categorySlug: string, page = 1, limit = 20) {
    return this.findAll({
      page,
      limit,
      category: categorySlug,
      sort: 'newest',
    });
  }

  /**
   * Get popular/trending books
   */
  async getPopularBooks(limit = 10) {
    const books = await this.prisma.book.findMany({
      take: limit,
      orderBy: [{ ratingsCount: 'desc' }, { avgRating: 'desc' }],
      include: {
        authors: {
          include: { author: true },
          orderBy: { displayOrder: 'asc' },
        },
        categories: {
          include: { category: true },
        },
      },
    });

    return { data: this.formatBooks(books) };
  }

  /**
   * Get newest books
   */
  async getNewestBooks(limit = 10) {
    const books = await this.prisma.book.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        authors: {
          include: { author: true },
          orderBy: { displayOrder: 'asc' },
        },
        categories: {
          include: { category: true },
        },
      },
    });

    return { data: this.formatBooks(books) };
  }

  /**
   * Format a single book for response
   */
  private formatBook(book: any) {
    return {
      id: book.id,
      isbn: book.isbn,
      ean: book.ean,
      title: book.title,
      originalTitle: book.originalTitle,
      description: book.description,
      coverUrl: book.coverUrl,
      publishedAt: book.publishedAt,
      publisher: book.publisher,
      pageCount: book.pageCount,
      language: book.language,
      formats: {
        paper: book.hasPaper,
        ebook: book.hasEbook,
        audiobook: book.hasAudiobook,
      },
      avgRating: Number(book.avgRating),
      ratingsCount: book.ratingsCount,
      authors: book.authors.map((ba: any) => ({
        id: ba.author.id,
        name: ba.author.name,
        role: ba.role,
      })),
      categories: book.categories.map((bc: any) => ({
        id: bc.category.id,
        name: bc.category.name,
        slug: bc.category.slug,
      })),
    };
  }

  /**
   * Format multiple books for response
   */
  private formatBooks(books: any[]) {
    return books.map((book) => this.formatBook(book));
  }
}
