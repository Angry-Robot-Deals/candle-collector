import { NestFactory } from '@nestjs/core';
import * as process from 'node:process';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const dotenv = import('dotenv');

(async function () {
  (await dotenv).configDotenv();

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.API_PORT);

  Logger.log(`🚀 http://localhost:${process.env.API_PORT}`);
})();
