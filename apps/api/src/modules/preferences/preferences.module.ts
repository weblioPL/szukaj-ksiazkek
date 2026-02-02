import { Module } from '@nestjs/common';
import { PreferencesService } from './preferences.service';

/**
 * Preferences Module
 *
 * Internal module for user preference aggregation.
 * No public endpoints - consumed by:
 * - Recommendation engine
 * - Claude context builder
 * - Personalization logic
 */
@Module({
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
