import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { AppService } from './app.service';
import { GlobalVariablesDBService } from './global-variables-db.service';
import { HttpAccessMiddleware } from './logging/http-access.middleware';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, PrismaService, GlobalVariablesDBService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpAccessMiddleware).forRoutes('*');
  }
}
