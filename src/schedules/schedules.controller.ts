import { Controller,Get,Post,Delete,Put,Param , Body, Query ,UseGuards} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtGuard } from '../guards/jwt.guard'; // JWT guard instead of API key


@Controller('schedules')
export class SchedulesController {

    constructor(private readonly schedulesService: SchedulesService) {}

@UseGuards(JwtGuard)
@Post('add')
    addSchedule(@Body() body: any) {
    return this.schedulesService.addSchedule(body);
  }

@UseGuards(JwtGuard)
@Get()
  getSchedules(@Query('domain') domain?: string) {
    return this.schedulesService.getSchedules(domain);
  }


  @UseGuards(JwtGuard)
  @Put(':id')
  updateSchedule(
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    return this.schedulesService.updateSchedule(+id, updateData);
  }

@UseGuards(JwtGuard)
@Delete(':id')
  removeScedule(@Param('id') id: number) {
    return this.schedulesService.deleteSchedule(+id);
  }



}
