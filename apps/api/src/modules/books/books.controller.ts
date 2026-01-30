import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { BooksService } from './books.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List books with filtering, search, and pagination',
    description: 'Search uses PostgreSQL full-text search for title, description, and author names',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search query (title, author, ISBN)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Category slug' })
  @ApiQuery({ name: 'format', required: false, enum: ['paper', 'ebook', 'audiobook'], description: 'Book format' })
  @ApiQuery({ name: 'sort', required: false, enum: ['relevance', 'title', 'rating', 'newest'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'List of books with pagination' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('format') format?: string,
    @Query('sort') sort?: 'relevance' | 'title' | 'rating' | 'newest',
  ) {
    return this.booksService.findAll({
      page: page ? Number(page) : 1,
      limit: Math.min(limit ? Number(limit) : 20, 100),
      search,
      category,
      format,
      sort,
    });
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List all categories with hierarchy' })
  @ApiResponse({ status: 200, description: 'List of categories with children and book counts' })
  async getCategories() {
    return this.booksService.getCategories();
  }

  @Public()
  @Get('popular')
  @ApiOperation({ summary: 'Get popular/trending books' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of books (default: 10)' })
  @ApiResponse({ status: 200, description: 'List of popular books' })
  async getPopular(@Query('limit') limit?: number) {
    return this.booksService.getPopularBooks(limit ? Number(limit) : 10);
  }

  @Public()
  @Get('newest')
  @ApiOperation({ summary: 'Get newest books' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of books (default: 10)' })
  @ApiResponse({ status: 200, description: 'List of newest books' })
  async getNewest(@Query('limit') limit?: number) {
    return this.booksService.getNewestBooks(limit ? Number(limit) : 10);
  }

  @Public()
  @Get('category/:slug')
  @ApiOperation({ summary: 'Get books by category' })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of books in category' })
  async getByCategory(
    @Param('slug') slug: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.booksService.getBooksByCategory(
      slug,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 100) : 20,
    );
  }

  @Public()
  @Get('isbn/:isbn')
  @ApiOperation({ summary: 'Get book by ISBN or EAN' })
  @ApiParam({ name: 'isbn', description: 'Book ISBN or EAN (13 digits)' })
  @ApiResponse({ status: 200, description: 'Book details' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async findByIsbn(@Param('isbn') isbn: string) {
    const book = await this.booksService.findByIsbn(isbn);
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get book by ID' })
  @ApiParam({ name: 'id', description: 'Book UUID' })
  @ApiResponse({ status: 200, description: 'Book details' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async findById(@Param('id') id: string) {
    const book = await this.booksService.findById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }
}
