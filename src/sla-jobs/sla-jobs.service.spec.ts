import { Test, TestingModule } from '@nestjs/testing';
import { SlaJobsService } from './sla-jobs.service';

describe('SlaJobsService', () => {
  let service: SlaJobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlaJobsService],
    }).compile();

    service = module.get<SlaJobsService>(SlaJobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
