import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { apiLogger } from './winston.config';

@Injectable()
export class HttpAccessMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') ?? '';

    // Capture body chunks for error logging
    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res) as typeof res.write;
    const originalEnd = res.end.bind(res) as typeof res.end;

    (res as any).write = function (chunk: any, ...rest: any[]): boolean {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return (originalWrite as any)(chunk, ...rest);
    };

    (res as any).end = function (chunk?: any, ...rest: any[]): Response {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }

      const ms = Date.now() - start;
      const { statusCode } = res;

      const base = { method, url: originalUrl, status: statusCode, ms, ip, userAgent };

      if (statusCode >= 400) {
        const body = Buffer.concat(chunks).toString('utf8').slice(0, 500);
        apiLogger.warn('HTTP error', { ...base, body });
      } else {
        apiLogger.info('HTTP access', base);
      }

      return (originalEnd as any)(chunk, ...rest);
    };

    next();
  }
}
