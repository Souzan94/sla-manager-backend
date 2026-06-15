import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledJob } from './scheduled-jobs.entity';

@Injectable()
export class ScheduledJobsService {
  constructor(
    @InjectRepository(ScheduledJob)
    private readonly jobRepository: Repository<ScheduledJob>,
  ) {}


  async createJob(body: any) {
    const { ticketId, domain, scheduleId, type, executeAt , onBreachTags } = body;

    const job = this.jobRepository.create({
      ticketId,
      domain,
      type, // 'warning' or 'breach'
      executeAt,
      status: 'pending',
      jobId: `${type}:${domain}_${ticketId}`,
      breachTags: onBreachTags
    });

    await this.jobRepository.save(job);

    return { message: `${type} job saved in DB` };
  }




  async updateJob(jobId: string, status: 'completed' | 'failed') {
  const job = await this.jobRepository.findOne({ where: { jobId } });
  if (!job) return null;

  job.status = status;

  return this.jobRepository.save(job);
}

  /**
   * Pause a job: store remaining delay and pausedAt timestamp
   */
  async pauseJob(jobId: string, data: { remainingDelayMs: number; pausedAt: Date }) {
    const job = await this.jobRepository.findOne({ where: { jobId } });
    if (!job) throw new NotFoundException(`Job not found: ${jobId}`);

    job.remainingDelayMs = data.remainingDelayMs;
    job.pausedAt = data.pausedAt;
    job.status = 'paused';

    return this.jobRepository.save(job);
  }

  /**
   * Find all jobs for a specific ticket + domain
   */
  async findTicketJobs(ticketId: string, domain: string) {
    return this.jobRepository.find({ where: { ticketId, domain } });
  }

  /**
   * Update arbitrary fields of a job (used for resetting remainingDelayMs, pausedAt, etc.)
   */
  async updateJobFields(jobId: string, data: Partial<ScheduledJob>) {
    const job = await this.jobRepository.findOne({ where: { jobId } });
    if (!job) throw new NotFoundException(`Job not found: ${jobId}`);

    Object.assign(job, data);
    return this.jobRepository.save(job);
  }

async findAllPendingJobs() {
  return this.jobRepository.find({
    where: { status: 'pending' },
  });
}

}


