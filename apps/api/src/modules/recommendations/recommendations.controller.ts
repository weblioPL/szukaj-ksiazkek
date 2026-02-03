import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  RecommendationQueryDto,
  RecommendationResponseDto,
  FormatFilterDto,
} from './dto/recommendations.dto';

/**
 * Recommendations Controller
 *
 * Exposes personalized book recommendations based on user preferences.
 * Uses deterministic, explainable scoring - no AI involved.
 */
@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

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
}
