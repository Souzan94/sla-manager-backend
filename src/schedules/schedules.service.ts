import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Schedule } from './schedules.entity';

@Injectable()
export class SchedulesService {

  constructor(
      @InjectRepository(Schedule)
      private scheduleRepository: Repository<Schedule>,) {}

async addSchedule(data: any) {

  const newSchedule = this.scheduleRepository.create({
    name: data.name,
    days: data.days,
    domain: data.domain,
  });

  const savedSchedule = await this.scheduleRepository.save(newSchedule);

  return {
    message: 'Schedule created successfully',
    id: savedSchedule.id
  };
}


async getSchedules(domain?: string) {
  const where = domain ? { domain } : {};
  const schedules = await this.scheduleRepository.find({
    where,
    relations: ['days'], // already fetching related days
  });

  return schedules.map(schedule => {
    let totalHours = 0;
    let openDays = 0;

    const days = schedule.days.map(day => {
      if (day.isWorkingDay && day.startTime && day.endTime) {
        const start = new Date(`1970-01-01T${day.startTime}`);
        const end = new Date(`1970-01-01T${day.endTime}`);
        const diff = (end.getTime() - start.getTime()) / 3600000;

        if (diff > 0) {
          totalHours += diff;
          openDays++;
        }
      }

      return {
        id: day.id,
        dayOfWeek: day.dayOfWeek,
        isWorkingDay: day.isWorkingDay,
        startTime: day.startTime,
        endTime: day.endTime,
      };
    });

    return {
      id: schedule.id,
      name: schedule.name,
      openDays,
      totalWeeklyHours: totalHours,
      days, // <-- include days here
   domain: schedule.domain,
    };
  });
}


async updateSchedule(id: number, updateData: any) {
  const schedule = await this.scheduleRepository.findOne({
    where: { id },
    relations: ['days'],
  });

  if (!schedule) {
    throw new NotFoundException(`Schedule with ID ${id} not found`);
  }

  // 1️⃣ Update schedule name
  schedule.name = updateData.name;

  // 2️⃣ Update each existing day
  schedule.days.forEach((existingDay) => {

    const updatedDay = updateData.days.find(
      d => d.dayOfWeek === existingDay.dayOfWeek
    );

    if (updatedDay) {
      existingDay.isWorkingDay = updatedDay.isWorkingDay;
      existingDay.startTime = updatedDay.startTime;
      existingDay.endTime = updatedDay.endTime;
    }
  });

  // 3️⃣ Save everything
  await this.scheduleRepository.save(schedule);

  return {
    message: `Schedule ${id} updated successfully`,
  };
}



async deleteSchedule(id: number) {
  const result = await this.scheduleRepository.delete(id);

  if (result.affected === 0) {
    throw new NotFoundException('Schedule not found');
  }

  return { message: 'Schedule deleted successfully' };
}


async findById(id: number) {
  const schedule = await this.scheduleRepository.findOne({
    where: { id },
    relations: ['days'],
  });
  if (!schedule) {
    throw new NotFoundException(`Schedule with ID ${id} not found`);
  }

  return schedule;

}
}
