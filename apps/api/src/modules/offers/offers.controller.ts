import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Public()
  @Get('book/:bookId')
  @ApiOperation({ summary: 'Get offers for a book' })
  @ApiQuery({ name: 'format', required: false, enum: ['paper', 'ebook', 'audiobook'] })
  @ApiResponse({ status: 200, description: 'List of offers' })
  async getOffersByBook(
    @Param('bookId') bookId: string,
    @Query('format') format?: string,
  ) {
    return this.offersService.getOffersByBookId(bookId, format);
  }
}
