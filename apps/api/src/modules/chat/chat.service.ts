import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClaudeClient } from '../claude/claude.client';
import {
  ClaudeContext,
  ConversationMessage,
  StreamChunk,
  UserContext,
  BookReference,
} from '../claude/claude.types';

/**
 * Chat Service
 *
 * Handles conversation management and AI interactions.
 * Integrates with Claude API for intelligent responses.
 *
 * Key responsibilities:
 * - Conversation CRUD operations
 * - Message persistence
 * - Context building for AI
 * - Streaming response handling
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeClient: ClaudeClient,
  ) {}

  /**
   * Get paginated list of user conversations
   */
  async getConversations(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId, isActive: true },
        skip,
        take: limit,
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.conversation.count({ where: { userId, isActive: true } }),
    ]);

    return {
      data: conversations.map((conv) => ({
        id: conv.id,
        title: conv.title || 'Nowa rozmowa',
        lastMessage: conv.messages[0]?.content.slice(0, 100),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single conversation with all messages
   */
  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation;
  }

  /**
   * Create a new conversation with initial message
   * Returns conversation ID and streams AI response
   */
  async createConversation(userId: string, message: string) {
    // Create conversation with initial user message
    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        messages: {
          create: {
            role: 'USER',
            content: message,
          },
        },
      },
      include: { messages: true },
    });

    // Generate title asynchronously (don't block response)
    this.generateAndSetTitle(conversation.id, message).catch((err) =>
      this.logger.error(`Failed to generate title: ${err}`),
    );

    return {
      conversationId: conversation.id,
      userMessageId: conversation.messages[0].id,
    };
  }

  /**
   * Stream AI response for a new conversation
   */
  async *streamNewConversationResponse(
    userId: string,
    conversationId: string,
    message: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Build context
    const context = await this.buildContext(userId, [], message);

    // Collect full response for persistence
    let fullContent = '';
    let mentionedBookIds: string[] = [];

    // Stream response from Claude
    for await (const chunk of this.claudeClient.streamMessage(context)) {
      if (chunk.type === 'text' && chunk.content) {
        fullContent += chunk.content;
      }

      if (chunk.type === 'metadata' && chunk.metadata?.mentionedBookIds) {
        mentionedBookIds = chunk.metadata.mentionedBookIds;
      }

      yield chunk;
    }

    // Persist assistant message after streaming completes
    if (fullContent) {
      await this.saveAssistantMessage(conversationId, fullContent, {
        mentionedBooks: mentionedBookIds,
      });
    }
  }

  /**
   * Add a message to existing conversation
   */
  async addMessage(userId: string, conversationId: string, content: string) {
    // Verify conversation belongs to user
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    // Save user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId,
      userMessageId: userMessage.id,
      existingMessages: conversation.messages,
    };
  }

  /**
   * Stream AI response for existing conversation
   */
  async *streamMessageResponse(
    userId: string,
    conversationId: string,
    newMessage: string,
    existingMessages: { role: string; content: string }[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Convert existing messages to conversation history
    const conversationHistory: ConversationMessage[] = existingMessages.map(
      (msg) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant',
        content: msg.content,
      }),
    );

    // Build context with history
    const context = await this.buildContext(
      userId,
      conversationHistory,
      newMessage,
    );

    // Collect full response for persistence
    let fullContent = '';
    let mentionedBookIds: string[] = [];

    // Stream response from Claude
    for await (const chunk of this.claudeClient.streamMessage(context)) {
      if (chunk.type === 'text' && chunk.content) {
        fullContent += chunk.content;
      }

      if (chunk.type === 'metadata' && chunk.metadata?.mentionedBookIds) {
        mentionedBookIds = chunk.metadata.mentionedBookIds;
      }

      yield chunk;
    }

    // Persist assistant message after streaming completes
    if (fullContent) {
      await this.saveAssistantMessage(conversationId, fullContent, {
        mentionedBooks: mentionedBookIds,
      });
    }
  }

  /**
   * Get non-streaming response (fallback for clients that don't support SSE)
   */
  async getResponse(
    userId: string,
    conversationId: string,
    message: string,
    existingMessages: { role: string; content: string }[] = [],
  ) {
    // Convert existing messages to conversation history
    const conversationHistory: ConversationMessage[] = existingMessages.map(
      (msg) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant',
        content: msg.content,
      }),
    );

    // Build context
    const context = await this.buildContext(
      userId,
      conversationHistory,
      message,
    );

    // Get response from Claude
    const response = await this.claudeClient.sendMessage(context);

    // Persist assistant message
    const assistantMessage = await this.saveAssistantMessage(
      conversationId,
      response.content,
      {
        mentionedBooks: response.mentionedBookIds,
        tokensUsed: response.tokensUsed,
      },
    );

    return assistantMessage;
  }

  /**
   * Delete (soft) a conversation
   */
  async deleteConversation(userId: string, conversationId: string) {
    const result = await this.prisma.conversation.updateMany({
      where: { id: conversationId, userId },
      data: { isActive: false },
    });

    return result.count > 0;
  }

  /**
   * Build context for Claude API call
   */
  private async buildContext(
    userId: string,
    conversationHistory: ConversationMessage[],
    currentMessage: string,
  ): Promise<ClaudeContext> {
    // Get user preferences and context
    const userContext = await this.buildUserContext(userId);

    // Get relevant books from catalog for context
    const catalogContext = await this.buildCatalogContext(userId);

    return {
      user: userContext,
      conversationHistory,
      currentMessage,
      catalog: catalogContext,
    };
  }

  /**
   * Build user context from database
   */
  private async buildUserContext(userId: string): Promise<UserContext> {
    const [user, preferences, readBooks, recentlyViewed] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      this.prisma.userPreference.findUnique({
        where: { userId },
      }),
      this.prisma.readBook.findMany({
        where: { userId },
        include: {
          book: {
            include: { authors: { include: { author: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Get recently viewed books from user's browsing history
      this.getRecentlyViewedBooks(userId),
    ]);

    // Calculate average rating
    const ratedBooks = readBooks.filter((rb) => rb.rating !== null);
    const averageRating =
      ratedBooks.length > 0
        ? ratedBooks.reduce((sum, rb) => sum + (rb.rating || 0), 0) /
          ratedBooks.length
        : undefined;

    return {
      userId,
      userName: user?.name || undefined,
      preferredCategories: preferences?.preferredCategories || [],
      preferredFormats: (preferences?.preferredFormats as ('paper' | 'ebook' | 'audiobook')[]) || [],
      readBooksCount: readBooks.length,
      averageRating,
      recentlyViewedBooks: recentlyViewed,
      recentlyRatedBooks: readBooks
        .filter((rb) => rb.rating !== null)
        .slice(0, 10)
        .map((rb) => ({
          id: rb.book.id,
          isbn: rb.book.isbn || undefined,
          title: rb.book.title,
          authors: rb.book.authors.map((a) => a.author.name),
          categories: [], // Would need to fetch from book categories
          rating: rb.rating!,
          status: rb.status.toLowerCase() as 'read' | 'reading' | 'want_to_read',
        })),
      recentPurchases: [], // Would need to implement purchase tracking
    };
  }

  /**
   * Get recently viewed books for user
   */
  private async getRecentlyViewedBooks(
    userId: string,
  ): Promise<BookReference[]> {
    // This would typically come from a browsing history table
    // For now, return empty array - will be implemented with analytics
    return [];
  }

  /**
   * Build catalog context with popular and relevant books
   */
  private async buildCatalogContext(userId: string) {
    const [popularBooks, newestBooks] = await Promise.all([
      this.prisma.book.findMany({
        where: { isActive: true },
        orderBy: { viewCount: 'desc' },
        take: 20,
        include: {
          authors: { include: { author: true } },
          categories: { include: { category: true } },
        },
      }),
      this.prisma.book.findMany({
        where: { isActive: true },
        orderBy: { publishedDate: 'desc' },
        take: 10,
        include: {
          authors: { include: { author: true } },
          categories: { include: { category: true } },
        },
      }),
    ]);

    const mapBookToReference = (book: any): BookReference => ({
      id: book.id,
      isbn: book.isbn || undefined,
      title: book.title,
      authors: book.authors.map((a: any) => a.author.name),
      categories: book.categories.map((c: any) => c.category.name),
    });

    return {
      popularBooks: popularBooks.map(mapBookToReference),
      newestBooks: newestBooks.map(mapBookToReference),
      categoryBooks: new Map<string, BookReference[]>(),
    };
  }

  /**
   * Save assistant message to database
   */
  private async saveAssistantMessage(
    conversationId: string,
    content: string,
    metadata: { mentionedBooks?: string[]; tokensUsed?: number },
  ) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content,
        metadata: {
          mentionedBooks: metadata.mentionedBooks || [],
          tokensUsed: metadata.tokensUsed,
        },
      },
    });
  }

  /**
   * Generate and set conversation title asynchronously
   */
  private async generateAndSetTitle(
    conversationId: string,
    firstMessage: string,
  ) {
    try {
      const title = await this.claudeClient.generateTitle(firstMessage);

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });

      this.logger.debug(`Generated title for conversation ${conversationId}: ${title}`);
    } catch (error) {
      this.logger.error(`Failed to generate title: ${error}`);
    }
  }
}
