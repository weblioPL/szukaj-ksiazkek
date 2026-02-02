import { Module } from '@nestjs/common';
import { BookshelfController } from './bookshelf.controller';
import { BookshelfService } from './bookshelf.service';

/**
 * Bookshelf Module
 *
 * Handles user book collections: reading status, ratings, and queries.
 * Core module for user preference tracking and recommendation signals.
 */
@Module({
  controllers: [BookshelfController],
  providers: [BookshelfService],
  exports: [BookshelfService],
})
export class BookshelfModule {}
