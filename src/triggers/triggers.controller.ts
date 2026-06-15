import { Controller,Get,Post, Body } from '@nestjs/common';
import { TriggersService } from './triggers.service';

@Controller('triggers')
export class TriggersController {



constructor(private readonly triggersService: TriggersService) {}




}
