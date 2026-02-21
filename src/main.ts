import { NestFactory } from '@nestjs/core';
import * as process from 'node:process';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const dotenv = import('dotenv');

BigInt.prototype['toJSON'] = function () {
  return this.toString();
};

const API_PORT = Number(process.env.API_PORT) || 14444;

(async function () {
  try {
    (await dotenv).configDotenv();

    const app = await NestFactory.create(AppModule);
    await app.listen(API_PORT);

    Logger.log(`🚀 http://localhost:${API_PORT}`);
  } catch (err) {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  }
})();
