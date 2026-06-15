import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holidays } from './holidays.entity';

@Injectable()
export class HolidaysService {

constructor(
    @InjectRepository(Holidays)
    private holidayRepository: Repository<Holidays>,) {}


 async addHoliday(data: any) {

  const newHoliday = this.holidayRepository.create({
    domain: data.domain,
    name: data.name,
    startDate: data.startDate,
    endDate: data.endDate
  });

  const savedHoliday = await this.holidayRepository.save(newHoliday);

  return {
    message: 'Holiday created successfully',
    id: savedHoliday.id
  };
}


async getHolidays(domain?: string) {
  const where = domain ? { domain: domain } : {};
  const holidays = await this.holidayRepository.find({ where });

  return holidays.map(h => ({
    id: h.id,
    name: h.name,
    startDate: h.startDate.toISOString().split('T')[0],
    endDate: h.endDate.toISOString().split('T')[0],
    domain: h.domain,
  }));
}

async remove(id: number) {
  const result = await this.holidayRepository.delete(id);

  if (result.affected === 0) {
    return { message: 'Holiday not found' };
  }

  return { message: 'Holiday deleted successfully' };
}

}
