import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BookshelfService } from './bookshelf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdateStatusDto,
  UpdateRatingDto,
  BookshelfQueryDto,
  BookshelfItemDto,
  BookshelfListResponseDto,
  BookshelfStatsDto,
  ReadingStatusDto,
} from './dto/bookshelf.dto';

/**
 * Bookshelf Controller
 *
 * Manages user's book collection: reading status, ratings, and listings.
 */
@ApiTags('bookshelf')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookshelf')
export class BookshelfController {
  constructor(private readonly bookshelfService: BookshelfService) {}

  /**
   * Get user's bookshelf
   */
  @Get()
  @ApiOperation({
    summary: 'Get bookshelf',
    description: 'Returns the current user\'s bookshelf with optional status filter',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ReadingStatusDto,
    description: 'Filter by reading status',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default 20, max 100)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination (ID of last item)',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookshelf items',
    type: BookshelfListResponseDto,
  })
  async getBookshelf(
    @CurrentUser('id') userId: string,
    @Query() query: BookshelfQueryDto,
  ): Promise<BookshelfListResponseDto> {
    return this.bookshelfService.getBookshelf(userId, {
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  /**
   * Get bookshelf statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get bookshelf statistics',
    description: 'Returns aggregated statistics about the user\'s bookshelf',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookshelf statistics',
    type: BookshelfStatsDto,
  })
  async getStats(@CurrentUser('id') userId: string): Promise<BookshelfStatsDto> {
    return this.bookshelfService.getStats(userId);
  }

  /**
   * Get a specific book's status in bookshelf
   */
  @Get(':bookId')
  @ApiOperation({
    summary: 'Get book status',
    description: 'Returns the status of a specific book in the user\'s bookshelf',
  })
  @ApiParam({ name: 'bookId', description: 'Book ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Book status in bookshelf',
    type: BookshelfItemDto,
  })
  @ApiResponse({ status: 404, description: 'Book not in bookshelf' })
  async getBookStatus(
    @CurrentUser('id') userId: string,
    @Param('bookId', ParseUUIDPipe) bookId: string,
  ): Promise<BookshelfItemDto> {
    const item = await this.bookshelfService.getBookshelfItem(userId, bookId);
    if (!item) {
      throw new NotFoundException('Book not found in your bookshelf');
    }
    return item;
  }

  /**
   * Update reading status for a book
   */
  @Post(':bookId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update book status',
    description:
      'Updates the reading status for a book. ' +
      'Creates a bookshelf entry if it doesn\'t exist. ' +
      'Does not affect existing rating.',
  })
  @ApiParam({ name: 'bookId', description: 'Book ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully',
    type: BookshelfItemDto,
  })
  @ApiResponse({ status: 404, description: 'Book not found in catalog' })
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('bookId', ParseUUIDPipe) bookId: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<BookshelfItemDto> {
    return this.bookshelfService.updateStatus(userId, bookId, dto.status);
  }

  /**
   * Update rating for a book
   */
  @Post(':bookId/rating')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rate a book',
    description:
      'Sets or updates the rating for a book. ' +
      'Rating is only allowed for books with status "read". ' +
      'Does not affect reading status.',
  })
  @ApiParam({ name: 'bookId', description: 'Book ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Rating updated successfully',
    type: BookshelfItemDto,
  })
  @ApiResponse({ status: 400, description: 'Rating only allowed for read books' })
  @ApiResponse({ status: 404, description: 'Book not found in catalog or bookshelf' })
  async updateRating(
    @CurrentUser('id') userId: string,
    @Param('bookId', ParseUUIDPipe) bookId: string,
    @Body() dto: UpdateRatingDto,
  ): Promise<BookshelfItemDto> {
    return this.bookshelfService.updateRating(userId, bookId, dto.rating);
  }

  /**
   * Remove book from bookshelf
   */
  @Delete(':bookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove from bookshelf',
    description: 'Removes a book from the user\'s bookshelf',
  })
  @ApiParam({ name: 'bookId', description: 'Book ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Book removed from bookshelf' })
  @ApiResponse({ status: 404, description: 'Book not in bookshelf' })
  async removeFromBookshelf(
    @CurrentUser('id') userId: string,
    @Param('bookId', ParseUUIDPipe) bookId: string,
  ): Promise<void> {
    const removed = await this.bookshelfService.removeFromBookshelf(userId, bookId);
    if (!removed) {
      throw new NotFoundException('Book not found in your bookshelf');
    }
  }
}
