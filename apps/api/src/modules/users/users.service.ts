import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id); // Ensure user exists

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id); // Ensure user exists

    // Soft delete by deactivating
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // For full GDPR compliance, you might want to:
    // 1. Delete or anonymize user data
    // 2. Revoke all refresh tokens
    // 3. Log the deletion request

    await this.prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { revokedAt: new Date() },
    });
  }

  async getStatistics(id: string) {
    const [booksCount, conversationsCount] = await Promise.all([
      this.prisma.userBook.count({ where: { userId: id } }),
      this.prisma.conversation.count({ where: { userId: id } }),
    ]);

    const readingStatusCounts = await this.prisma.userBook.groupBy({
      by: ['status'],
      where: { userId: id },
      _count: true,
    });

    return {
      totalBooks: booksCount,
      totalConversations: conversationsCount,
      readingStatus: readingStatusCounts.reduce(
        (acc, item) => ({ ...acc, [item.status.toLowerCase()]: item._count }),
        {},
      ),
    };
  }
}
