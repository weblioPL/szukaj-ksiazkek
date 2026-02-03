import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { PreferencesModule } from '../preferences/preferences.module';

/**
 * Recommendations Module
 *
 * Provides personalized book recommendations using deterministic
 * scoring algorithms. No AI - pure heuristic-based matching.
 *
 * Depends on:
 * - PreferencesModule: For user affinity data
 * - PrismaService: For book catalog access (via global module)
 */
@Module({
  imports: [PreferencesModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
