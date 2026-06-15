import { Controller, Post, Body, Logger,Get } from '@nestjs/common';
import { SlaJobsService } from './sla-jobs.service';
import { SlaRecoveryService } from './sla-recovery.service';
@Controller('sla-jobs')
export class SlaJobsController {
  private readonly logger = new Logger(SlaJobsController.name);

  constructor(
    private readonly slaJobsService: SlaJobsService,
    private readonly slaRecoveryService: SlaRecoveryService
  ) {}

  // Existing endpoint
  @Post('start-sla')
  async ticketCreated(@Body() payload: any) {
    this.logger.log(`Received SLA payload: ${JSON.stringify(payload)}`);

    await this.slaJobsService.scheduleSLAJobs(payload);

    return {
      message: 'SLA jobs scheduled successfully',
    };
  }

  // NEW: Pause SLA jobs (e.g., ticket changed to Pending)
@Post('pause')
async pauseSLA(
  @Body() body: { payload: { ticket: string; domain: string } },
) {
  const { ticket, domain } = body.payload;

  await this.slaJobsService.pauseTicketJobs(ticket, domain);

  
  this.logger.log(`Pausing SLA jobs for ticket: ${ticket}`);

  return {
    message: `SLA jobs paused for ticket ${ticket}`,
  };
}

  // NEW: Resume SLA jobs (e.g., ticket changed back to Open)
  @Post('resume')
async resumeSLA(@Body() body: { payload: { ticket: string; domain: string } }) {
  const { ticket, domain } = body.payload;

  this.logger.log(`Resuming SLA jobs for ticket: ${ticket}`);

  await this.slaJobsService.resumeTicketJobs(ticket, domain);

  return {
    message: `SLA jobs resumed for ticket ${ticket}`,
  };
}
@Get('recover')
async recover() {
  return this.slaRecoveryService.recoverPendingJobs();
}

}