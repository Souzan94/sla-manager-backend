import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { JwtGuard } from '../guards/jwt.guard'; // JWT guard instead of API key

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidayService: HolidaysService) {}


  @UseGuards(JwtGuard)
  @Post('add')
  addHoliday(@Body() body: any) {
    return this.holidayService.addHoliday(body);
  }

  @UseGuards(JwtGuard)
  @Get()
  getHolidays(@Query('domain') domain?: string) {
    return this.holidayService.getHolidays(domain);
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.holidayService.remove(+id);
  }
}