import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'production') {
      const models = Reflect.ownKeys(this).filter((key) => {
        const keyString = String(key);
        return !keyString.startsWith('_') && !keyString.startsWith('$') && typeof this[key] === 'object';
      });

      return Promise.all(
        models.map((modelKey) => {
          const model = this[modelKey as keyof PrismaService];
          if (model && typeof (model as any).deleteMany === 'function') {
            return (model as any).deleteMany();
          }
          return Promise.resolve();
        }),
      );
    }
  }
}
