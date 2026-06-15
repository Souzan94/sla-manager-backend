import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Schedule } from './schedules.entity';

@Entity('schedule_days')
@Unique(['schedule', 'dayOfWeek']) // prevents duplicate day per schedule
export class ScheduleDay {

  @PrimaryGeneratedColumn()
  id: number;

  // 0 = Sunday, 1 = Monday ... 6 = Saturday
  @Column({ type: 'int' })
  dayOfWeek: number;

  
   @Column()
  isWorkingDay: boolean;

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  
  @ManyToOne(() => Schedule, (schedule) => schedule.days, {
    onDelete: 'CASCADE',
  })
  schedule: Schedule;
}