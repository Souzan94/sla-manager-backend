import { Test, TestingModule } from '@nestjs/testing';
import { SlarulesController } from './slarules.controller';

describe('SlarulesController', () => {
  let controller: SlarulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlarulesController],
    }).compile();

    controller = module.get<SlarulesController>(SlarulesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
