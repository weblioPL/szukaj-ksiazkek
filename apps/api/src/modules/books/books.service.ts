import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    format?: string;
  }) {
    const { page = 1, limit = 20, search, category, format } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      };
    }

    if (format) {
      const formatMap: Record<string, string> = {
        paper: 'hasPaper',
        ebook: 'hasEbook',
        audiobook: 'hasAudiobook',
      };
      if (formatMap[format]) {
        where[formatMap[format]] = true;
      }
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.book.count({ where }),
    ]);

    return {
      data: books.map((book) => ({
        ...book,
        authors: book.authors.map((ba) => ({
          id: ba.author.id,
          name: ba.author.name,
          role: ba.role,
        })),
        categories: book.categories.map((bc) => ({
          id: bc.category.id,
          name: bc.category.name,
          slug: bc.category.slug,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

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

    return {
      ...book,
      authors: book.authors.map((ba) => ({
        id: ba.author.id,
        name: ba.author.name,
        role: ba.role,
      })),
      categories: book.categories.map((bc) => ({
        id: bc.category.id,
        name: bc.category.name,
        slug: bc.category.slug,
      })),
    };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }
}
