import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsExplainService } from './recommendations-explain.service';
import { PreferencesModule } from '../preferences/preferences.module';

/**
 * Recommendations Module
 *
 * Provides personalized book recommendations with two layers:
 *
 * 1. Deterministic Engine (RecommendationsService)
 *    - Pure heuristic-based scoring
 *    - Weighted formula: category, author, format, popularity
 *    - No AI dependency
 *
 * 2. AI Explanation Layer (RecommendationsExplainService)
 *    - Claude explains WHY books are recommended
 *    - Answers "why this?" and "what else?" questions
 *    - Strict guardrails: can only discuss catalog books
 *
 * Depends on:
 * - PreferencesModule: For user affinity data
 * - ClaudeModule: For AI explanations (global module)
 * - PrismaService: For book catalog access (global module)
 */
@Module({
  imports: [PreferencesModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationsExplainService],
  exports: [RecommendationsService, RecommendationsExplainService],
})
export class RecommendationsModule {}
