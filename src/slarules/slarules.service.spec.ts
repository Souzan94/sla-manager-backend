import { Test, TestingModule } from '@nestjs/testing';
import { SlarulesService } from './slarules.service';

describe('SlarulesService', () => {
  let service: SlarulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlarulesService],
    }).compile();

    service = module.get<SlarulesService>(SlarulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
