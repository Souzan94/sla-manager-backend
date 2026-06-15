import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

import { ScheduledJobsService } from '../scheduled-jobs/scheduled-jobs.service';

@Injectable()
export class SlaRecoveryService {
  private readonly logger = new Logger(SlaRecoveryService.name);

  constructor(
    private readonly scheduledJobsService: ScheduledJobsService,

    @InjectQueue('sla-queue')
    private readonly slaQueue: Queue,
  ) {}

  /**
   * Recover all pending SLA jobs from DB and recreate them in Redis
   */
  async recoverPendingJobs() {
    this.logger.log('🚀 Starting SLA recovery process...');

    const jobs = await this.scheduledJobsService.findAllPendingJobs();

    if (!jobs.length) {
      this.logger.log('No pending jobs found for recovery');
      return;
    }

    const now = Date.now();

    for (const job of jobs) {
      try {
        // ✅ Validate executeAt exists
        if (!job.executeAt) {
          this.logger.warn(`Job ${job.jobId} has no executeAt, skipping`);
          continue;
        }

        const executeAtTime = new Date(job.executeAt).getTime();

        // ✅ Validate date
        if (isNaN(executeAtTime)) {
          this.logger.error(`Invalid executeAt for job ${job.jobId}`, {
            executeAt: job.executeAt,
          });
          continue;
        }

        // ✅ Calculate delay
        const delay = executeAtTime - now;

        if (delay <= 0) {
          this.logger.warn(
            `Job ${job.jobId} already expired (${delay} ms), skipping`,
          );
          continue;
        }

        // ✅ Prevent duplicate jobs in Redis
        const existingJob = await this.slaQueue.getJob(job.jobId);
        if (existingJob) {
          this.logger.warn(
            `Job ${job.jobId} already exists in queue, skipping`,
          );
          continue;
        }

        // ✅ Recreate job in Redis
        await this.slaQueue.add(
          job.type, // 'warning' | 'breach'
          {
            ticket: job.ticketId,
            domain: job.domain,
            onBreachTags: job.breachTags,
          },
          {
            delay,
            jobId: job.jobId,
          },
        );

        this.logger.log(
          `✅ Recovered job ${job.jobId} (type: ${job.type}) with delay ${delay} ms`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to recover job ${job.jobId}`,
          error.stack,
        );
      }
    }

    this.logger.log('🎯 SLA recovery completed');
  }
}