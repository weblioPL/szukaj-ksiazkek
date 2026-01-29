import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BookFormat } from '@prisma/client';

// Placeholder service - will be expanded in Stage 2 with BUYBOX API integration
@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOffersByBookId(bookId: string, format?: string) {
    const where: any = {
      bookId,
      isAvailable: true,
    };

    if (format) {
      where.format = format.toUpperCase() as BookFormat;
    }

    const offers = await this.prisma.offer.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    return {
      data: offers.map((offer) => ({
        id: offer.id,
        storeName: offer.storeName,
        storeLogoUrl: offer.storeLogoUrl,
        format: offer.format.toLowerCase(),
        price: Number(offer.price),
        originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        currency: offer.currency,
        url: offer.url,
        isAvailable: offer.isAvailable,
      })),
    };
  }

  async getLowestPrices(bookId: string) {
    const offers = await this.prisma.offer.findMany({
      where: { bookId, isAvailable: true },
      orderBy: { price: 'asc' },
    });

    const lowestByFormat: Record<string, number> = {};

    for (const offer of offers) {
      const format = offer.format.toLowerCase();
      if (!lowestByFormat[format] || Number(offer.price) < lowestByFormat[format]) {
        lowestByFormat[format] = Number(offer.price);
      }
    }

    return lowestByFormat;
  }

  // TODO: Implement BUYBOX API integration in Stage 2
  async syncOffersFromBuybox(bookIsbn: string) {
    // This will call BUYBOX API and update offers in database
    console.log(`TODO: Sync offers for ISBN ${bookIsbn} from BUYBOX`);
    return { status: 'not_implemented' };
  }
}
