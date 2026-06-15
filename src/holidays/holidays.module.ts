import { Module } from '@nestjs/common';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Holidays } from './holidays.entity';

@Module({
      imports: [TypeOrmModule.forFeature([Holidays])],
  
  controllers: [HolidaysController],
  providers: [HolidaysService],
  exports: [HolidaysService], // <-- export the service so it can be used in other modules
})
export class HolidaysModule {}
