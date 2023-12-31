import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as process from 'node:process';

const dotenv = import('dotenv');

async function bootstrap() {
  (await dotenv).configDotenv();

  /// <reference types="node" />
  process.setMaxListeners(15);

  // console.log('PrismaService init', process.env.DATABASE_URL);

  const app = await NestFactory.create(AppModule);
  await app.listen(14444);
}
bootstrap();
