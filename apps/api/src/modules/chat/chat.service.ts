import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// Placeholder service - will be expanded in Stage 3 with Claude API integration
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

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
        title: conv.title || 'New conversation',
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

    // TODO: In Stage 3, this will call Claude API and stream the response
    // For now, return a placeholder response
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: 'Witaj! Jestem asystentem, który pomoże Ci znaleźć idealne książki. Opowiedz mi, jakich książek szukasz lub co ostatnio czytałeś.',
        metadata: { mentionedBooks: [] },
      },
    });

    return {
      conversationId: conversation.id,
      message: assistantMessage,
    };
  }

  async addMessage(userId: string, conversationId: string, content: string) {
    // Verify conversation belongs to user
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return null;
    }

    // Save user message
    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content,
      },
    });

    // TODO: In Stage 3, this will call Claude API and stream the response
    // For now, return a placeholder response
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: 'Dziękuję za wiadomość! Funkcja AI chat będzie dostępna w następnej wersji aplikacji.',
        metadata: { mentionedBooks: [] },
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return assistantMessage;
  }

  async deleteConversation(userId: string, conversationId: string) {
    const result = await this.prisma.conversation.updateMany({
      where: { id: conversationId, userId },
      data: { isActive: false },
    });

    return result.count > 0;
  }
}
