import { Process, Processor, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import axios from 'axios';
import { ScheduledJobsService } from '../scheduled-jobs/scheduled-jobs.service';

@Processor('sla-queue')
export class SlaJobsProcessor {
  constructor(@InjectQueue('sla-queue') private readonly slaQueue: Queue,
 private readonly scheduledJobsService: ScheduledJobsService, ) {}

  /**
   * Check Zendesk ticket status and get existing tags
   */
  private async getZendeskTicketStatus(ticketId: string): Promise<{ status: string | null; tags: string[] }> {
    try {
      const subdomain = process.env.ZENDESK_SUBDOMAIN;
      const email = process.env.ZENDESK_EMAIL;
      const apiToken = process.env.ZENDESK_API_TOKEN;
      const auth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');

      const url = `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`;
      const resp = await axios.get(url, {
        headers: { Authorization: `Basic ${auth}` },
      });
      return {
        status: resp.data.ticket.status,
        tags: resp.data.ticket.tags || [],
      };
    } catch (err) {
      console.error(`Error fetching Zendesk ticket ${ticketId}:`, err.message);
      return { status: null, tags: [] };
    }
  }

  /**
   * Tag Zendesk ticket with one or more tags
   */
  private async tagZendeskTicket(ticketId: string, tags: string | string[]): Promise<boolean> {
    try {
      const subdomain = process.env.ZENDESK_SUBDOMAIN;
      const email = process.env.ZENDESK_EMAIL;
      const apiToken = process.env.ZENDESK_API_TOKEN;
      const auth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');

      const tagArray = Array.isArray(tags) ? tags : [tags];
      const url = `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`;
      await axios.put(url, {
        ticket: { tags: tagArray },
      }, {
        headers: { Authorization: `Basic ${auth}` },
      });
      return true;
    } catch (err) {
      console.error(`Error tagging Zendesk ticket ${ticketId}:`, err.message);
      return false;
    }
  }

  @Process('warning')
  async handleWarning(job: Job) {
    console.log('⚠ SLA WARNING job triggered:', job.data);

    const ticketId = job.data.jobData?.ticket || job.data.ticket;
    const domain = job.data.jobData?.domain || job.data.domain;
    const { status, tags } = await this.getZendeskTicketStatus(ticketId);

    if (status === 'closed' || status === 'solved') {
      const breachJobId = `breach-${domain}_${ticketId}`;
      const breachJob = await this.slaQueue.getJob(breachJobId);
      if (breachJob) {
        await breachJob.remove();
        console.log(`🗑️  Cancelled breach job for ticket ${ticketId} (ticket solved/closed)`);
      }
    } else {
      // Merge existing tags with warning tag (avoid duplicates)
      const mergedTags = Array.from(new Set([...tags, 'sla_warning_alert']));
      await this.tagZendeskTicket(ticketId, mergedTags);
      console.log(`🏷️  Added sla_warning tag to ticket ${ticketId}`);
    }
     const warningJobId = `warning:${domain}_${ticketId}`;
  await this.scheduledJobsService.updateJob(warningJobId, 'completed');

  }

  @Process('breach')
  async handleBreach(job: Job) {
    console.log('🚨 SLA BREACH job triggered:', job.data);

    const ticketId = job.data.jobData?.ticket || job.data.ticket;
        const domain = job.data.jobData?.domain || job.data.domain;

    const onBreachTags = job.data.jobData?.onBreachTags || job.data.onBreachTags || [];
    const { status, tags } = await this.getZendeskTicketStatus(ticketId);

    if (status !== 'closed' && status !== 'solved') {
      // Merge existing tags with breach tags (avoid duplicates)
      const mergedTags = Array.from(new Set([...tags, ...onBreachTags]));
      await this.tagZendeskTicket(ticketId, mergedTags);
      console.log(`🏷️  Added breach tags to ticket ${ticketId}:`, mergedTags);
    }

  const breachJobId = `breach:${domain}_${ticketId}`;
  await this.scheduledJobsService.updateJob(breachJobId, 'completed');
  }
}