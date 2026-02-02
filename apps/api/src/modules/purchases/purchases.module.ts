import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { MockPurchaseProvider } from './providers/mock-purchase.provider';
import { BuyboxPurchaseProvider } from './providers/buybox-purchase.provider';
import { PURCHASE_PROVIDER_TOKEN, IPurchaseProvider } from './purchases.types';

/**
 * Purchases Module
 *
 * Handles purchase history integration with BUYBOX.
 *
 * Provider selection:
 * - Development/Test: Uses MockPurchaseProvider (generates realistic test data)
 * - Production: Uses BuyboxPurchaseProvider (TODO: implement when API is ready)
 *
 * The provider can be controlled via the USE_MOCK_PURCHASES environment variable:
 * - USE_MOCK_PURCHASES=true: Force mock provider
 * - USE_MOCK_PURCHASES=false: Use real BUYBOX provider
 * - Not set: Auto-detect based on NODE_ENV and provider availability
 */
@Module({
  controllers: [PurchasesController],
  providers: [
    PurchasesService,
    MockPurchaseProvider,
    BuyboxPurchaseProvider,
    {
      provide: PURCHASE_PROVIDER_TOKEN,
      useFactory: (
        configService: ConfigService,
        mockProvider: MockPurchaseProvider,
        buyboxProvider: BuyboxPurchaseProvider,
      ): IPurchaseProvider => {
        const useMock = configService.get<string>('USE_MOCK_PURCHASES');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');

        // Explicit mock setting takes precedence
        if (useMock === 'true') {
          return mockProvider;
        }

        if (useMock === 'false') {
          return buyboxProvider;
        }

        // Auto-detect: Use mock in development or when BUYBOX is not available
        if (nodeEnv === 'development' || !buyboxProvider.isAvailable()) {
          return mockProvider;
        }

        return buyboxProvider;
      },
      inject: [ConfigService, MockPurchaseProvider, BuyboxPurchaseProvider],
    },
  ],
  exports: [PurchasesService],
})
export class PurchasesModule {}
