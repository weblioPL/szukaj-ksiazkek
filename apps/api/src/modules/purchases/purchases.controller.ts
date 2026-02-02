import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Purchases Controller
 *
 * API endpoints for user purchase history.
 * Integrates with BUYBOX to fetch and manage purchase data.
 */
@ApiTags('purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  /**
   * Get current user's purchase history
   */
  @Get()
  @ApiOperation({
    summary: 'Get purchase history',
    description:
      'Returns the current user\'s purchase history. ' +
      'Automatically syncs with BUYBOX if data is stale.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Purchase history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        purchases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              buyboxOrderId: { type: 'string' },
              storeName: { type: 'string' },
              format: { type: 'string', enum: ['paper', 'ebook', 'audiobook'] },
              price: { type: 'number' },
              currency: { type: 'string' },
              purchasedAt: { type: 'string', format: 'date-time' },
              syncedAt: { type: 'string', format: 'date-time' },
              book: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  coverUrl: { type: 'string' },
                  authors: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
        lastSyncAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getPurchases(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.purchasesService.getPurchases(
      userId,
      page || 1,
      Math.min(limit || 20, 50),
    );
  }

  /**
   * Force refresh purchase history from BUYBOX
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh purchase history',
    description:
      'Forces a refresh of the purchase history from BUYBOX. ' +
      'Use this if you believe purchases are missing or outdated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase history refreshed',
    schema: {
      type: 'object',
      properties: {
        synced: { type: 'number', description: 'Total purchases synced' },
        new: { type: 'number', description: 'New purchases added' },
        updated: { type: 'number', description: 'Existing purchases updated' },
        failed: { type: 'number', description: 'Purchases that failed to sync' },
        errors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Error messages if any',
        },
        syncedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async refreshPurchases(@CurrentUser('id') userId: string) {
    return this.purchasesService.refreshPurchases(userId);
  }

  /**
   * Get purchase statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get purchase statistics',
    description:
      'Returns aggregated statistics about user\'s purchases. ' +
      'Useful for understanding spending patterns and format preferences.',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total number of purchases' },
        byFormat: {
          type: 'object',
          description: 'Purchase count by format',
          additionalProperties: { type: 'number' },
        },
        byStore: {
          type: 'object',
          description: 'Purchase count by store',
          additionalProperties: { type: 'number' },
        },
        totalSpent: { type: 'number', description: 'Total amount spent (PLN)' },
      },
    },
  })
  async getPurchaseStats(@CurrentUser('id') userId: string) {
    return this.purchasesService.getPurchaseStats(userId);
  }
}
