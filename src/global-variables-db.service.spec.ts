import { Test, TestingModule } from '@nestjs/testing';
import { GlobalVariablesDbService } from './global-variables-db.service';

describe('GlobalVariablesDbService', () => {
  let service: GlobalVariablesDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalVariablesDbService],
    }).compile();

    service = module.get<GlobalVariablesDbService>(GlobalVariablesDbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
