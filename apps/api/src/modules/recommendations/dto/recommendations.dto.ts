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
  IsUUID,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
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

// ============================================
// AI Explanation DTOs
// ============================================

/**
 * Request body for POST /recommendations/explain
 */
export class ExplainRequestDto {
  @ApiProperty({
    description: 'Book ID to explain',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  bookId: string;

  @ApiPropertyOptional({
    description: 'Optional user question for context (e.g., "Why is this recommended?")',
    example: 'Dlaczego ta książka jest dla mnie polecana?',
  })
  @IsOptional()
  @IsString()
  context?: string;
}

/**
 * Alternative book suggestion
 */
export class AlternativeBookDto {
  @ApiProperty({ description: 'Book ID' })
  id: string;

  @ApiProperty({ description: 'Book title' })
  title: string;

  @ApiProperty({ description: 'Author names', type: [String] })
  authors: string[];

  @ApiProperty({ description: 'Why this is suggested as alternative' })
  reason: string;
}

/**
 * Response for POST /recommendations/explain
 */
export class ExplainResponseDto {
  @ApiProperty({ description: 'Book ID that was explained' })
  bookId: string;

  @ApiProperty({
    description: 'AI-generated explanation in Polish',
    example: 'Polecamy tę książkę, ponieważ:\n• Lubisz książki fantasy\n• Czytałeś już książki tego autora',
  })
  explanation: string;

  @ApiProperty({
    description: 'Algorithmic reasons from deterministic engine',
    type: [String],
  })
  reasons: string[];

  @ApiProperty({
    description: 'Confidence score from user preference data (0-1)',
    minimum: 0,
    maximum: 1,
  })
  confidence: number;

  @ApiPropertyOptional({
    description: 'Alternative books to try (from catalog only)',
    type: [AlternativeBookDto],
  })
  alternatives?: AlternativeBookDto[];
}

/**
 * Request body for POST /recommendations/compare
 */
export class CompareRequestDto {
  @ApiProperty({
    description: 'Book IDs to compare (2-5 books)',
    example: ['uuid1', 'uuid2', 'uuid3'],
    minItems: 2,
    maxItems: 5,
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  bookIds: string[];

  @ApiPropertyOptional({
    description: 'User question about the comparison',
    example: 'Która z tych książek lepiej do mnie pasuje i dlaczego?',
  })
  @IsOptional()
  @IsString()
  question?: string;
}

/**
 * Compared book info
 */
export class ComparedBookDto {
  @ApiProperty({ description: 'Book ID' })
  id: string;

  @ApiProperty({ description: 'Book title' })
  title: string;

  @ApiProperty({ description: 'Author names', type: [String] })
  authors: string[];

  @ApiProperty({
    description: 'Recommendation score (0-1)',
    minimum: 0,
    maximum: 1,
  })
  score: number;

  @ApiProperty({ description: 'Matched category names', type: [String] })
  matchedCategories: string[];

  @ApiProperty({ description: 'Matched author names', type: [String] })
  matchedAuthors: string[];
}

/**
 * Response for POST /recommendations/compare
 */
export class CompareResponseDto {
  @ApiProperty({
    description: 'Books being compared with their scores',
    type: [ComparedBookDto],
  })
  books: ComparedBookDto[];

  @ApiProperty({
    description: 'AI-generated comparison in Polish',
    example: 'Porównanie książek:\n\n"Książka A" - ma wyższe dopasowanie kategorii...',
  })
  comparison: string;

  @ApiPropertyOptional({
    description: 'ID of the best fitting book based on preferences',
  })
  bestFitId?: string;

  @ApiPropertyOptional({
    description: 'Why the best fit was chosen',
    example: 'Najwyższy wynik dopasowania: 85%',
  })
  bestFitReason?: string;
}
