import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { BuyboxModule } from './modules/buybox/buybox.module';
import { ClaudeModule } from './modules/claude/claude.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BooksModule } from './modules/books/books.module';
import { ChatModule } from './modules/chat/chat.module';
import { OffersModule } from './modules/offers/offers.module';
import { ImportModule } from './modules/import/import.module';
import { HealthModule } from './modules/health/health.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    BuyboxModule,
    ClaudeModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BooksModule,
    ChatModule,
    OffersModule,
    ImportModule,
  ],
})
export class AppModule {}
