import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Reading status values
 */
export enum ReadingStatusDto {
  WANT_TO_READ = 'want_to_read',
  READING = 'reading',
  READ = 'read',
}

/**
 * DTO for updating book status
 */
export class UpdateStatusDto {
  @ApiProperty({
    enum: ReadingStatusDto,
    example: 'reading',
    description: 'Reading status for the book',
  })
  @IsEnum(ReadingStatusDto, {
    message: 'status must be one of: want_to_read, reading, read',
  })
  status: ReadingStatusDto;
}

/**
 * DTO for setting/updating book rating
 */
export class UpdateRatingDto {
  @ApiProperty({
    minimum: 1,
    maximum: 5,
    example: 4,
    description: 'Rating from 1 to 5 (only allowed when status is read)',
  })
  @IsInt({ message: 'rating must be an integer' })
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must be at most 5' })
  rating: number;
}

/**
 * Query parameters for bookshelf listing
 */
export class BookshelfQueryDto {
  @ApiPropertyOptional({
    enum: ReadingStatusDto,
    description: 'Filter by reading status',
  })
  @IsOptional()
  @IsEnum(ReadingStatusDto)
  status?: ReadingStatusDto;

  @ApiPropertyOptional({
    default: 20,
    description: 'Number of items per page',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (last item ID)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/**
 * Book details in bookshelf response
 */
export class BookshelfBookDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  coverUrl?: string;

  @ApiProperty({ type: [String] })
  authors: string[];

  @ApiProperty({ type: [String] })
  categories: string[];
}

/**
 * Single bookshelf item response
 */
export class BookshelfItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  bookId: string;

  @ApiProperty({ enum: ReadingStatusDto })
  status: ReadingStatusDto;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  rating?: number;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  finishedAt?: Date;

  @ApiPropertyOptional()
  statusChangedAt?: Date;

  @ApiPropertyOptional()
  ratedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: BookshelfBookDto })
  book: BookshelfBookDto;
}

/**
 * Bookshelf list response
 */
export class BookshelfListResponseDto {
  @ApiProperty({ type: [BookshelfItemDto] })
  items: BookshelfItemDto[];

  @ApiPropertyOptional({ description: 'Cursor for next page' })
  nextCursor?: string;

  @ApiProperty()
  total: number;
}

/**
 * Bookshelf statistics response
 */
export class BookshelfStatsDto {
  @ApiProperty({ description: 'Count of books by status' })
  byStatus: {
    want_to_read: number;
    reading: number;
    read: number;
  };

  @ApiProperty({ description: 'Total books in bookshelf' })
  total: number;

  @ApiPropertyOptional({ description: 'Average rating of read books' })
  averageRating?: number;

  @ApiProperty({ description: 'Number of rated books' })
  ratedCount: number;
}
