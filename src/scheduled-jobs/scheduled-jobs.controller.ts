import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ScheduledJobsService } from './scheduled-jobs.service';

@Controller('scheduled-jobs')
export class ScheduledJobsController {
  constructor(private readonly jobsService: ScheduledJobsService) {}

  @Post()
  create(@Body() body: any) {
    return this.jobsService.createJob(body);
  }

  
}
