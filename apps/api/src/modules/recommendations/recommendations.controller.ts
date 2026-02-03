import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsExplainService } from './recommendations-explain.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  RecommendationQueryDto,
  RecommendationResponseDto,
  FormatFilterDto,
  ExplainRequestDto,
  ExplainResponseDto,
  CompareRequestDto,
  CompareResponseDto,
} from './dto/recommendations.dto';

/**
 * Recommendations Controller
 *
 * Exposes personalized book recommendations based on user preferences.
 *
 * Architecture:
 * - GET /recommendations: Deterministic scoring, no AI
 * - POST /recommendations/explain: AI explains why a book is recommended
 * - POST /recommendations/compare: AI compares multiple books
 *
 * AI Guardrails:
 * - Claude can only discuss books from the catalog
 * - All suggestions must be from the allowed book list
 * - Refuses to recommend non-catalog books
 */
@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly explainService: RecommendationsExplainService,
  ) {}

  /**
   * Get personalized book recommendations
   */
  @Get()
  @ApiOperation({
    summary: 'Get recommendations',
    description:
      'Returns personalized book recommendations based on user preferences. ' +
      'Uses a deterministic scoring algorithm considering category, author, ' +
      'format preferences, and popularity. Falls back to popular books if ' +
      'user has insufficient reading history.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum recommendations to return (default 10, max 50)',
  })
  @ApiQuery({
    name: 'debug',
    required: false,
    type: Boolean,
    description: 'Include debug scoring information in response',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: FormatFilterDto,
    description: 'Filter by book format',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Personalized recommendations',
    type: RecommendationResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async getRecommendations(
    @CurrentUser('id') userId: string,
    @Query() query: RecommendationQueryDto,
  ): Promise<RecommendationResponseDto> {
    return this.recommendationsService.getRecommendations(userId, {
      limit: query.limit,
      debug: query.debug,
      format: query.format,
      categoryId: query.categoryId,
    });
  }

  /**
   * Explain why a book is recommended
   *
   * Uses Claude AI to provide natural Polish explanation.
   * Claude does NOT generate recommendations - only explains them.
   */
  @Post('explain')
  @ApiOperation({
    summary: 'Explain recommendation',
    description:
      'Uses AI to explain why a specific book is recommended for the user. ' +
      'The explanation is generated in Polish and includes: ' +
      '• 2-4 bullet reasons based on user preferences\n' +
      '• A short summary sentence\n' +
      '• Optional alternative suggestions from the catalog\n\n' +
      'Note: AI can only discuss books from the catalog.',
  })
  @ApiResponse({
    status: 200,
    description: 'Book recommendation explanation',
    type: ExplainResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Book not found in catalog',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async explainRecommendation(
    @CurrentUser('id') userId: string,
    @Body() dto: ExplainRequestDto,
  ): Promise<ExplainResponseDto> {
    return this.explainService.explain(userId, {
      bookId: dto.bookId,
      context: dto.context,
    });
  }

  /**
   * Compare multiple books
   *
   * Uses Claude AI to compare books and suggest the best fit.
   * All books must be from the catalog.
   */
  @Post('compare')
  @ApiOperation({
    summary: 'Compare books',
    description:
      'Uses AI to compare multiple books (2-5) and recommend the best fit ' +
      'based on user preferences. Response includes:\n' +
      '• Score and matching factors for each book\n' +
      '• AI-generated comparison in Polish\n' +
      '• The best fitting book with explanation\n\n' +
      'All books must exist in the catalog.',
  })
  @ApiResponse({
    status: 200,
    description: 'Book comparison with best fit recommendation',
    type: CompareResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (wrong number of books)',
  })
  @ApiResponse({
    status: 404,
    description: 'One or more books not found in catalog',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  async compareBooks(
    @CurrentUser('id') userId: string,
    @Body() dto: CompareRequestDto,
  ): Promise<CompareResponseDto> {
    return this.explainService.compare(userId, {
      bookIds: dto.bookIds,
      question: dto.question,
    });
  }
}
