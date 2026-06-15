import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledJob } from './scheduled-jobs.entity';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { ScheduledJobsController } from './scheduled-jobs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduledJob])],
  providers: [ScheduledJobsService],
  controllers: [ScheduledJobsController],
  exports: [ScheduledJobsService],
})
export class ScheduledJobsModule {}
