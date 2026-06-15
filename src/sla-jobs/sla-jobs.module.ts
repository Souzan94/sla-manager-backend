import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SlaJobsProcessor } from './sla-jobs.processor';
import { SlaJobsService } from './sla-jobs.service';
import { SlaRecoveryService } from './sla-recovery.service';
import { SlaJobsController } from './sla-jobs.controller';
import { SchedulesModule } from '../schedules/schedules.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';

@Module({
  imports: [
    // Register the SLA queue for this module
    BullModule.registerQueue({
      name: 'sla-queue', // must match the name used in @InjectQueue
    }),

    // Import modules providing dependent services
    SchedulesModule,
    HolidaysModule,
    ScheduledJobsModule,
  ],
  providers: [SlaJobsProcessor, SlaJobsService , SlaRecoveryService],
  controllers: [SlaJobsController],
  exports: [SlaJobsService], // allow other modules to use SlaJobsService
})
export class SlaJobsModule {}