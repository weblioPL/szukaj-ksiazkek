import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Sse,
  MessageEvent,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StreamChunk } from '../claude/claude.types';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'List user conversations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getConversations(
      userId,
      page || 1,
      Math.min(limit || 20, 50),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Start a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body('message') message: string,
  ) {
    return this.chatService.createConversation(userId, message);
  }

  /**
   * Stream AI response for a new conversation
   * Uses Server-Sent Events (SSE) for real-time streaming
   */
  @Post(':id/stream')
  @ApiOperation({ summary: 'Stream AI response for new conversation' })
  @ApiResponse({ status: 200, description: 'Streaming response' })
  async streamNewConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body('message') message: string,
    @Res() res: Response,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.chatService.streamNewConversationResponse(
        userId,
        conversationId,
        message,
      );

      for await (const chunk of stream) {
        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const errorData = JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.write(`data: ${errorData}\n\n`);
      res.end();
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    const conversation = await this.chatService.getConversation(
      userId,
      conversationId,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message to conversation (non-streaming)' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async addMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body('content') content: string,
  ) {
    const result = await this.chatService.addMessage(
      userId,
      conversationId,
      content,
    );
    if (!result) {
      throw new NotFoundException('Conversation not found');
    }

    // Get AI response (non-streaming)
    const assistantMessage = await this.chatService.getResponse(
      userId,
      conversationId,
      content,
      result.existingMessages,
    );

    return {
      userMessageId: result.userMessageId,
      assistantMessage,
    };
  }

  /**
   * Stream AI response for existing conversation
   * Uses Server-Sent Events (SSE) for real-time streaming
   */
  @Post(':id/messages/stream')
  @ApiOperation({ summary: 'Send message and stream AI response' })
  @ApiResponse({ status: 200, description: 'Streaming response' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async streamMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body('content') content: string,
    @Res() res: Response,
  ) {
    // First, save the user message and get conversation context
    const result = await this.chatService.addMessage(
      userId,
      conversationId,
      content,
    );

    if (!result) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial metadata
    res.write(
      `data: ${JSON.stringify({ type: 'init', userMessageId: result.userMessageId })}\n\n`,
    );

    try {
      const stream = this.chatService.streamMessageResponse(
        userId,
        conversationId,
        content,
        result.existingMessages,
      );

      for await (const chunk of stream) {
        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const errorData = JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.write(`data: ${errorData}\n\n`);
      res.end();
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete conversation' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    const deleted = await this.chatService.deleteConversation(
      userId,
      conversationId,
    );
    if (!deleted) {
      throw new NotFoundException('Conversation not found');
    }
  }
}
