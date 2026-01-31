import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PromptService } from './prompt.service';
import {
  ClaudeContext,
  ClaudeResponse,
  StreamChunk,
  ConversationMessage,
  BookReference,
} from './claude.types';

/**
 * Claude API Client
 *
 * Handles all communication with Claude API.
 * Supports both streaming and non-streaming responses.
 *
 * Key responsibilities:
 * - API authentication and configuration
 * - Streaming response handling
 * - Token usage tracking
 * - Error handling and logging
 */
@Injectable()
export class ClaudeClient implements OnModuleInit {
  private readonly logger = new Logger(ClaudeClient.name);
  private client: Anthropic | null = null;
  private readonly model = 'claude-sonnet-4-20250514';
  private readonly maxTokens = 1024;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptService: PromptService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('anthropic.apiKey');

    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY is not configured. Claude API calls will fail.',
      );
      return;
    }

    this.client = new Anthropic({ apiKey });
    this.logger.log('Claude client initialized');
  }

  /**
   * Check if client is properly configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Send a message and get a complete response (non-streaming)
   */
  async sendMessage(context: ClaudeContext): Promise<ClaudeResponse> {
    if (!this.client) {
      throw new Error('Claude client is not configured');
    }

    const systemPrompt = this.promptService.getSystemPrompt();
    const userPrompt = this.promptService.buildCompletePrompt({
      userContext: context.user,
      conversationHistory: context.conversationHistory,
      currentMessage: context.currentMessage,
      availableBooks: context.catalog?.popularBooks,
    });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '';

      return {
        content,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        mentionedBookIds: this.extractBookIds(content),
        stopReason: response.stop_reason || 'end_turn',
      };
    } catch (error) {
      this.logger.error(`Claude API error: ${error}`);
      throw error;
    }
  }

  /**
   * Send a message and stream the response
   * Returns an async generator that yields chunks
   */
  async *streamMessage(
    context: ClaudeContext,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.client) {
      yield {
        type: 'error',
        error: 'Claude client is not configured',
      };
      return;
    }

    const systemPrompt = this.promptService.getSystemPrompt();
    const userPrompt = this.promptService.buildCompletePrompt({
      userContext: context.user,
      conversationHistory: context.conversationHistory,
      currentMessage: context.currentMessage,
      availableBooks: context.catalog?.popularBooks,
    });

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      let fullContent = '';

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          fullContent += text;

          yield {
            type: 'text',
            content: text,
          };
        }
      }

      // Final message with metadata
      const finalMessage = await stream.finalMessage();
      const tokensUsed =
        finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;

      yield {
        type: 'metadata',
        metadata: {
          mentionedBookIds: this.extractBookIds(fullContent),
          tokensUsed,
        },
      };

      yield { type: 'done' };
    } catch (error) {
      this.logger.error(`Claude streaming error: ${error}`);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate a conversation title based on first message
   */
  async generateTitle(firstMessage: string): Promise<string> {
    if (!this.client) {
      return 'Nowa rozmowa';
    }

    try {
      const prompt = this.promptService.getTitleGenerationPrompt(firstMessage);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }],
      });

      const title =
        response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : 'Nowa rozmowa';

      // Ensure title is not too long
      return title.length > 50 ? title.substring(0, 47) + '...' : title;
    } catch (error) {
      this.logger.error(`Title generation error: ${error}`);
      return 'Nowa rozmowa';
    }
  }

  /**
   * Generate explanation for a recommendation
   */
  async explainRecommendation(
    book: BookReference,
    userContext: {
      userId: string;
      userName?: string;
      preferredCategories: string[];
      preferredFormats: ('paper' | 'ebook' | 'audiobook')[];
      readBooksCount: number;
      averageRating?: number;
      recentlyViewedBooks: BookReference[];
      recentlyRatedBooks: any[];
      recentPurchases: any[];
    },
    algorithmicReason: string,
  ): Promise<string> {
    if (!this.client) {
      return algorithmicReason;
    }

    try {
      const prompt = this.promptService.getRecommendationExplanationPrompt(
        book,
        userContext,
        algorithmicReason,
      );

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : algorithmicReason;
    } catch (error) {
      this.logger.error(`Explanation generation error: ${error}`);
      return algorithmicReason;
    }
  }

  /**
   * Extract book IDs mentioned in response
   * Looks for patterns like [ID:uuid] in the text
   */
  private extractBookIds(text: string): string[] {
    const pattern = /\[ID:([a-f0-9-]+)\]/gi;
    const matches = text.matchAll(pattern);
    const ids: string[] = [];

    for (const match of matches) {
      if (match[1] && !ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }

    return ids;
  }
}
