import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { Schedule } from './schedules.entity';
import { ScheduleDay } from './schedule-days.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, ScheduleDay]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService], // <-- export the service so it can be used in other modules
})
export class SchedulesModule {}