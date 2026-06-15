import { Module } from '@nestjs/common';
import { SlarulesController } from './slarules.controller';
import { SlarulesService } from './slarules.service';
import { SlaRule  } from './slarules.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TriggersModule } from '../triggers/triggers.module'; 

@Module({
        imports: [TypeOrmModule.forFeature([SlaRule]),TriggersModule],
  
  controllers: [SlarulesController],
  providers: [SlarulesService]
})
export class SlarulesModule {}
