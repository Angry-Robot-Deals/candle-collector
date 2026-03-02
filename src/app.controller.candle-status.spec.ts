/**
 * Unit tests for AppController pause/resume candle-status endpoints.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppController } from './app.controller';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Controller: () => () => {},
    Get: () => () => {},
    Post: () => () => {},
    Patch: () => () => {},
    HttpCode: () => () => {},
    Injectable: () => () => {},
  };
});

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------
const mockAppService = {};

function makePrisma(marketExists: boolean, statusRecExists: boolean) {
  return {
    market: {
      findUnique: jest.fn().mockResolvedValue(marketExists ? { id: 1 } : null),
    },
    getCandleUpdateStatus: jest.fn().mockResolvedValue(
      statusRecExists ? { id: 1, status: 0 } : null,
    ),
    updateCandleStatusFields: jest.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Helper: directly invoke the private setCandleStatus via controller instance
// ---------------------------------------------------------------------------
function makeController(prisma: ReturnType<typeof makePrisma>) {
  return new AppController(mockAppService as any, prisma as any);
}

describe('AppController — candle-status endpoints', () => {
  describe('pauseCandleStatus', () => {
    it('sets status to -200 and returns { ok: true, status: -200 }', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      const result = await ctrl.pauseCandleStatus('1', '15');

      expect(prisma.updateCandleStatusFields).toHaveBeenCalledWith(1, 15, { status: -200 });
      expect(result).toEqual({ ok: true, status: -200 });
    });
  });

  describe('resumeCandleStatus', () => {
    it('sets status to 0 and returns { ok: true, status: 0 }', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      const result = await ctrl.resumeCandleStatus('1', '15');

      expect(prisma.updateCandleStatusFields).toHaveBeenCalledWith(1, 15, { status: 0 });
      expect(result).toEqual({ ok: true, status: 0 });
    });
  });

  describe('validation', () => {
    it('throws BadRequestException for invalid marketId (NaN)', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('abc', '15')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for marketId = 0', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('0', '15')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for negative marketId', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('-5', '15')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid tf (not in VALID_TF_MINUTES)', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('1', '999')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for float tf', async () => {
      const prisma = makePrisma(true, true);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('1', '15.5')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when market does not exist', async () => {
      const prisma = makePrisma(false, true);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('999', '15')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when CandleUpdateStatus record does not exist', async () => {
      const prisma = makePrisma(true, false);
      const ctrl = makeController(prisma);

      await expect(ctrl.pauseCandleStatus('1', '15')).rejects.toThrow(NotFoundException);
    });

    it('accepts all valid tf values', async () => {
      // M1=1, M15=15, H1=60, D1=1440
      for (const tf of ['1', '15', '60', '1440']) {
        const prisma = makePrisma(true, true);
        const ctrl = makeController(prisma);
        const result = await ctrl.pauseCandleStatus('1', tf);
        expect(result.ok).toBe(true);
      }
    });
  });
});
