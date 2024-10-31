import { Test, TestingModule } from '@nestjs/testing';
import { GlobalVariablesDBService } from './global-variables-db.service';

describe('GlobalVariablesDbService', () => {
  let service: GlobalVariablesDBService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalVariablesDBService],
    }).compile();

    service = module.get<GlobalVariablesDBService>(GlobalVariablesDBService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
