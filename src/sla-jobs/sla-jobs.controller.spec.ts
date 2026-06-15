import { Test, TestingModule } from '@nestjs/testing';
import { SlaJobsController } from './sla-jobs.controller';

describe('SlaJobsController', () => {
  let controller: SlaJobsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlaJobsController],
    }).compile();

    controller = module.get<SlaJobsController>(SlaJobsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
