import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BookImportData,
  BookImportResult,
  BatchImportResult,
  ImportOptions,
} from './import.types';

/**
 * Import Service
 *
 * Handles importing books from external product feeds.
 * Supports JSON data and manages authors/categories automatically.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Import multiple books from an array of book data
   */
  async importBooks(
    books: BookImportData[],
    options: ImportOptions = {},
  ): Promise<BatchImportResult> {
    const startTime = Date.now();
    const {
      updateExisting = false,
      requireIsbn = false,
      createCategories = true,
      createAuthors = true,
      batchSize = 100,
    } = options;

    const results: BookImportResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < books.length; i += batchSize) {
      const batch = books.slice(i, i + batchSize);

      for (const bookData of batch) {
        try {
          const result = await this.importSingleBook(bookData, {
            updateExisting,
            requireIsbn,
            createCategories,
            createAuthors,
          });

          results.push(result);

          switch (result.status) {
            case 'created':
              created++;
              break;
            case 'updated':
              updated++;
              break;
            case 'skipped':
              skipped++;
              break;
            case 'error':
              errors++;
              break;
          }
        } catch (error) {
          errors++;
          results.push({
            isbn: bookData.isbn,
            title: bookData.title,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.logger.log(`Processed ${Math.min(i + batchSize, books.length)}/${books.length} books`);
    }

    const duration = Date.now() - startTime;

    return {
      totalProcessed: books.length,
      created,
      updated,
      skipped,
      errors,
      results,
      duration,
    };
  }

  /**
   * Import a single book
   */
  async importSingleBook(
    data: BookImportData,
    options: ImportOptions = {},
  ): Promise<BookImportResult> {
    const {
      updateExisting = false,
      requireIsbn = false,
      createCategories = true,
      createAuthors = true,
    } = options;

    // Validate required fields
    if (!data.title) {
      return {
        isbn: data.isbn,
        title: data.title || 'Unknown',
        status: 'error',
        error: 'Title is required',
      };
    }

    const isbn = data.isbn || data.ean;

    if (requireIsbn && !isbn) {
      return {
        title: data.title,
        status: 'skipped',
        error: 'ISBN/EAN is required',
      };
    }

    // Check if book already exists
    let existingBook = null;
    if (isbn) {
      existingBook = await this.prisma.book.findFirst({
        where: {
          OR: [{ isbn }, { ean: isbn }],
        },
      });
    }

    if (existingBook && !updateExisting) {
      return {
        isbn,
        title: data.title,
        status: 'skipped',
        bookId: existingBook.id,
        error: 'Book already exists',
      };
    }

    // Parse authors
    const authorNames = this.parseStringArray(data.authors);
    const authorIds: string[] = [];

    if (createAuthors && authorNames.length > 0) {
      for (const name of authorNames) {
        const author = await this.findOrCreateAuthor(name);
        authorIds.push(author.id);
      }
    }

    // Parse categories
    const categoryNames = this.parseStringArray(data.categories);
    const categoryIds: string[] = [];

    if (createCategories && categoryNames.length > 0) {
      for (const name of categoryNames) {
        const category = await this.findOrCreateCategory(name);
        categoryIds.push(category.id);
      }
    }

    // Parse publication date
    let publishedAt: Date | null = null;
    if (data.publishedAt) {
      publishedAt = this.parseDate(data.publishedAt);
    }

    // Determine formats
    const hasPaper = data.formats?.paper ?? true;
    const hasEbook = data.formats?.ebook ?? false;
    const hasAudiobook = data.formats?.audiobook ?? false;

    // Create or update book
    const bookData = {
      isbn: data.isbn || null,
      ean: data.ean || null,
      title: data.title,
      originalTitle: data.originalTitle || null,
      description: data.description || null,
      coverUrl: data.coverUrl || null,
      publishedAt,
      publisher: data.publisher || null,
      pageCount: data.pageCount || null,
      language: data.language || 'pl',
      hasPaper,
      hasEbook,
      hasAudiobook,
    };

    let book;
    let status: 'created' | 'updated';

    if (existingBook) {
      // Update existing book
      book = await this.prisma.book.update({
        where: { id: existingBook.id },
        data: bookData,
      });
      status = 'updated';
    } else {
      // Create new book
      book = await this.prisma.book.create({
        data: bookData,
      });
      status = 'created';
    }

    // Update author associations
    if (authorIds.length > 0) {
      // Remove existing associations
      await this.prisma.bookAuthor.deleteMany({
        where: { bookId: book.id },
      });

      // Create new associations
      await this.prisma.bookAuthor.createMany({
        data: authorIds.map((authorId, index) => ({
          bookId: book.id,
          authorId,
          displayOrder: index,
        })),
      });
    }

    // Update category associations
    if (categoryIds.length > 0) {
      // Remove existing associations
      await this.prisma.bookCategory.deleteMany({
        where: { bookId: book.id },
      });

      // Create new associations
      await this.prisma.bookCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          bookId: book.id,
          categoryId,
        })),
      });
    }

    return {
      isbn: book.isbn || book.ean || undefined,
      title: book.title,
      status,
      bookId: book.id,
    };
  }

  /**
   * Find or create an author by name
   */
  private async findOrCreateAuthor(name: string) {
    const trimmedName = name.trim();

    let author = await this.prisma.author.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } },
    });

    if (!author) {
      author = await this.prisma.author.create({
        data: { name: trimmedName },
      });
    }

    return author;
  }

  /**
   * Find or create a category by name
   */
  private async findOrCreateCategory(name: string) {
    const trimmedName = name.trim();
    const slug = this.createSlug(trimmedName);

    let category = await this.prisma.category.findFirst({
      where: { slug },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: trimmedName,
          slug,
        },
      });
    }

    return category;
  }

  /**
   * Parse a string or array into an array of strings
   */
  private parseStringArray(value?: string | string[]): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }

  /**
   * Parse a date string into a Date object
   */
  private parseDate(value: string): Date | null {
    if (!value) return null;

    // Try ISO format first
    const isoDate = new Date(value);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try year only
    const year = parseInt(value, 10);
    if (!isNaN(year) && year >= 1000 && year <= 9999) {
      return new Date(year, 0, 1);
    }

    return null;
  }

  /**
   * Create a URL-friendly slug from a string
   */
  private createSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[ł]/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
}
