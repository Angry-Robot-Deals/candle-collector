import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { AppService } from './app.service';
import { GlobalVariablesDBService } from './global-variables-db.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, PrismaService, GlobalVariablesDBService],
})
export class AppModule {}
