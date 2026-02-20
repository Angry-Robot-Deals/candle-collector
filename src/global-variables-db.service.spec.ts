import { Test, TestingModule } from '@nestjs/testing';
import { GlobalVariablesDBService } from './global-variables-db.service';
import { PrismaService } from './prisma.service';

describe('GlobalVariablesDbService', () => {
  let service: GlobalVariablesDBService;

  const mockPrisma = {
    globalVar: {
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalVariablesDBService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GlobalVariablesDBService>(GlobalVariablesDBService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
