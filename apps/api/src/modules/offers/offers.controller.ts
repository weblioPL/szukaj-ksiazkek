import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Public()
  @Get('book/:bookId')
  @ApiOperation({ summary: 'Get offers for a book by internal ID' })
  @ApiParam({ name: 'bookId', description: 'Internal book UUID' })
  @ApiQuery({ name: 'format', required: false, enum: ['paper', 'ebook', 'audiobook'] })
  @ApiResponse({ status: 200, description: 'List of offers' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async getOffersByBook(
    @Param('bookId') bookId: string,
    @Query('format') format?: string,
  ) {
    return this.offersService.getOffersByBookId(bookId, format);
  }

  @Public()
  @Get('isbn/:isbn')
  @ApiOperation({
    summary: 'Get offers by ISBN/EAN',
    description: 'Fetches offers directly from BUYBOX using ISBN/EAN. If the book exists in catalog, offers will be cached.',
  })
  @ApiParam({ name: 'isbn', description: 'Book ISBN or EAN (13 digits)' })
  @ApiQuery({ name: 'format', required: false, enum: ['paper', 'ebook', 'audiobook'] })
  @ApiResponse({ status: 200, description: 'List of offers' })
  async getOffersByIsbn(
    @Param('isbn') isbn: string,
    @Query('format') format?: string,
  ) {
    return this.offersService.getOffersByIsbn(isbn, format);
  }

  @Post('book/:bookId/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force refresh offers for a book',
    description: 'Invalidates cached offers and fetches fresh data from BUYBOX',
  })
  @ApiParam({ name: 'bookId', description: 'Internal book UUID' })
  @ApiResponse({ status: 200, description: 'Offers refreshed' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async refreshOffers(@Param('bookId') bookId: string) {
    return this.offersService.refreshOffers(bookId);
  }
}
