import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsString,
} from 'class-validator';

/**
 * Format filter enum
 */
export enum FormatFilterDto {
  PAPER = 'paper',
  EBOOK = 'ebook',
  AUDIOBOOK = 'audiobook',
}

/**
 * Query parameters for GET /recommendations
 */
export class RecommendationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of recommendations to return',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Include debug scoring information in response',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  debug?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by book format',
    enum: FormatFilterDto,
  })
  @IsOptional()
  @IsEnum(FormatFilterDto)
  format?: FormatFilterDto;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

/**
 * Book formats DTO
 */
export class BookFormatsDto {
  @ApiProperty({ description: 'Paper version available' })
  paper: boolean;

  @ApiProperty({ description: 'Ebook version available' })
  ebook: boolean;

  @ApiProperty({ description: 'Audiobook version available' })
  audiobook: boolean;
}

/**
 * Recommended book DTO
 */
export class RecommendedBookDto {
  @ApiProperty({ description: 'Book ID' })
  id: string;

  @ApiPropertyOptional({ description: 'ISBN number' })
  isbn?: string;

  @ApiProperty({ description: 'Book title' })
  title: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  coverUrl?: string;

  @ApiPropertyOptional({ description: 'Book description' })
  description?: string;

  @ApiProperty({ description: 'Author names', type: [String] })
  authors: string[];

  @ApiProperty({ description: 'Category names', type: [String] })
  categories: string[];

  @ApiProperty({ description: 'Available formats', type: BookFormatsDto })
  formats: BookFormatsDto;

  @ApiProperty({ description: 'Average rating (1-5)' })
  avgRating: number;

  @ApiProperty({ description: 'Number of ratings' })
  ratingsCount: number;

  @ApiProperty({ description: 'Has available offers from stores' })
  hasOffers: boolean;
}

/**
 * Debug scoring info DTO
 */
export class RecommendationDebugDto {
  @ApiProperty({ description: 'Category affinity score (0-1)' })
  categoryScore: number;

  @ApiProperty({ description: 'Author affinity score (0-1)' })
  authorScore: number;

  @ApiProperty({ description: 'Format preference score (0-1)' })
  formatScore: number;

  @ApiProperty({ description: 'Popularity score (0-1)' })
  popularityScore: number;

  @ApiProperty({ description: 'Matched category names', type: [String] })
  matchedCategories: string[];

  @ApiProperty({ description: 'Matched author names', type: [String] })
  matchedAuthors: string[];

  @ApiPropertyOptional({ description: 'Matched format' })
  matchedFormat?: string;
}

/**
 * Single recommendation DTO
 */
export class RecommendationItemDto {
  @ApiProperty({ description: 'Recommended book', type: RecommendedBookDto })
  book: RecommendedBookDto;

  @ApiProperty({
    description: 'Recommendation score (0-1, higher is better match)',
    minimum: 0,
    maximum: 1,
  })
  score: number;

  @ApiProperty({
    description: 'Human-readable reasons for this recommendation',
    type: [String],
  })
  reasons: string[];

  @ApiPropertyOptional({
    description: 'Debug scoring information (only if debug=true)',
    type: RecommendationDebugDto,
  })
  debug?: RecommendationDebugDto;
}

/**
 * Response metadata DTO
 */
export class RecommendationMetaDto {
  @ApiProperty({
    description: 'Confidence level in recommendations (0-1)',
    minimum: 0,
    maximum: 1,
  })
  confidence: number;

  @ApiProperty({
    description: 'Whether fallback to popular books was used (insufficient user data)',
  })
  fallbackUsed: boolean;

  @ApiProperty({ description: 'Total candidate books considered' })
  candidatesConsidered: number;

  @ApiProperty({ description: 'Books excluded (already read, negative signals)' })
  excluded: number;

  @ApiProperty({ description: 'Algorithm version identifier' })
  algorithmVersion: string;
}

/**
 * Full recommendations response DTO
 */
export class RecommendationResponseDto {
  @ApiProperty({
    description: 'Recommended books with scores and reasons',
    type: [RecommendationItemDto],
  })
  items: RecommendationItemDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: RecommendationMetaDto,
  })
  meta: RecommendationMetaDto;
}
