import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportService } from './import.service';
import { BookImportData, ImportOptions } from './import.types';

/**
 * Import Controller
 *
 * Provides endpoints for importing books from external feeds.
 * Requires authentication (admin access recommended for production).
 */
@ApiTags('import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('books')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import books from JSON data',
    description: 'Import multiple books from a product feed. Creates authors and categories automatically.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        books: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              isbn: { type: 'string', description: 'ISBN-13' },
              ean: { type: 'string', description: 'EAN' },
              title: { type: 'string', description: 'Book title (required)' },
              originalTitle: { type: 'string' },
              description: { type: 'string' },
              coverUrl: { type: 'string' },
              publishedAt: { type: 'string' },
              publisher: { type: 'string' },
              pageCount: { type: 'number' },
              language: { type: 'string', default: 'pl' },
              authors: {
                oneOf: [
                  { type: 'string', description: 'Comma-separated names' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
              categories: {
                oneOf: [
                  { type: 'string', description: 'Comma-separated names' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
              formats: {
                type: 'object',
                properties: {
                  paper: { type: 'boolean' },
                  ebook: { type: 'boolean' },
                  audiobook: { type: 'boolean' },
                },
              },
            },
            required: ['title'],
          },
        },
        options: {
          type: 'object',
          properties: {
            updateExisting: { type: 'boolean', default: false },
            requireIsbn: { type: 'boolean', default: false },
            createCategories: { type: 'boolean', default: true },
            createAuthors: { type: 'boolean', default: true },
            batchSize: { type: 'number', default: 100 },
          },
        },
      },
      required: ['books'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Import results',
    schema: {
      type: 'object',
      properties: {
        totalProcessed: { type: 'number' },
        created: { type: 'number' },
        updated: { type: 'number' },
        skipped: { type: 'number' },
        errors: { type: 'number' },
        duration: { type: 'number', description: 'Duration in milliseconds' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              isbn: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['created', 'updated', 'skipped', 'error'] },
              bookId: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async importBooks(
    @Body('books') books: BookImportData[],
    @Body('options') options?: ImportOptions,
  ) {
    return this.importService.importBooks(books, options);
  }

  @Post('book')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import a single book',
    description: 'Import a single book. Creates authors and categories automatically.',
  })
  @ApiResponse({ status: 200, description: 'Import result' })
  async importSingleBook(
    @Body() bookData: BookImportData,
    @Body('options') options?: ImportOptions,
  ) {
    return this.importService.importSingleBook(bookData, options);
  }
}
