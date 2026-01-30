import { Module, Global } from '@nestjs/common';
import { BuyboxClient } from './buybox.client';

/**
 * BUYBOX Module
 *
 * Provides the BUYBOX API client as a global service.
 * This module encapsulates all BUYBOX-related logic and should be
 * the only entry point for BUYBOX API communication.
 */
@Global()
@Module({
  providers: [BuyboxClient],
  exports: [BuyboxClient],
})
export class BuyboxModule {}
