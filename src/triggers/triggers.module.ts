import { Module } from '@nestjs/common';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trigger } from './triggers.entity';
import { Webhook } from '../webhooks/webhooks.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trigger, Webhook])],
  controllers: [TriggersController],
  providers: [TriggersService],
  exports: [TriggersService], // <-- export the service so it can be used in other modules
})
export class TriggersModule {}