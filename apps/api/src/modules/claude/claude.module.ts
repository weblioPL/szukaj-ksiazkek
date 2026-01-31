import { Module, Global } from '@nestjs/common';
import { ClaudeClient } from './claude.client';
import { PromptService } from './prompt.service';

/**
 * Claude Module
 *
 * Provides Claude API integration services globally.
 * All AI-related functionality is centralized here.
 */
@Global()
@Module({
  providers: [ClaudeClient, PromptService],
  exports: [ClaudeClient, PromptService],
})
export class ClaudeModule {}
