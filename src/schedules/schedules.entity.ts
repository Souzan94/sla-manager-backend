
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { ScheduleDay } from './schedule-days.entity';

@Entity('schedules')
export class Schedule {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  

  @OneToMany(() => ScheduleDay, (day) => day.schedule, {
    cascade: true,
    eager: true,
  })
  days: ScheduleDay[];


    @Column()
  domain: string;

}


