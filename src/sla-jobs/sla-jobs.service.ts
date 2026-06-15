import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { SchedulesService } from '../schedules/schedules.service';
import { HolidaysService } from '../holidays/holidays.service';
import { ScheduledJobsService } from '../scheduled-jobs/scheduled-jobs.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

@Injectable()
export class SlaJobsService {
  private readonly logger = new Logger(SlaJobsService.name);

  constructor(
    @InjectQueue('sla-queue') private readonly slaQueue: Queue,
    private readonly schedulesService: SchedulesService,
    private readonly holidaysService: HolidaysService,
    private readonly scheduledJobsService: ScheduledJobsService,
  ) {}

  /**
   * Schedule SLA jobs for a ticket
   */
  async scheduleSLAJobs(raw: any) {
    this.logger.log('STEP 1 - start scheduling');

    // some webhooks wrap the actual data inside a "payload" property
    const payload = raw.payload ? raw.payload : raw;
    const item = payload.Item || payload.item || {};

    const { ticket, scheduleId, responseTime, warningTime, createdDate, timeZone, domain, users, groups, placeholders, onBreachTags } =
      item;

  
    
    if (!timeZone || !this.isValidTimeZone(timeZone)) {
      throw new Error(`Invalid timeZone: ${timeZone}`);
    }

    this.logger.log('STEP 2 - loading schedule');
    const schedule = await this.schedulesService.findById(scheduleId);
    if (!schedule || !schedule.days || schedule.days.length === 0) {
      throw new Error(`Schedule not found or invalid: ${scheduleId}`);
    }

    this.logger.log('STEP 3 - loading holidays');
    const holidaysData = await this.holidaysService.getHolidays();
    const holidays = holidaysData.map(h => ({
      start: dayjs(h.startDate).startOf('day'),
      end: dayjs(h.endDate).endOf('day'),
    }));

    // Parse the date - if it already has a timezone offset (+HH:MM), dayjs will use that
    // Otherwise, interpret it as being in the specified timezone
    let createdAt = dayjs(createdDate);
    if (!createdAt.isValid() || (!createdDate.includes('+') && !createdDate.includes('Z'))) {
      // If no offset in string, treat it as being in the specified timezone
      createdAt = dayjs.tz(createdDate, timeZone);
    }
    // Note: If the date already has a timezone offset, use it as-is
    // Don't call .tz() again to avoid double conversion

    // 1️⃣ Calculate breach date first
    const breachDate = this.calculateSlaDate(createdAt, responseTime, schedule, holidays, timeZone);

    // 2️⃣ Calculate warning date before breach
    const warningDate = this.calculateSlaDateBackwards(breachDate, warningTime, schedule, holidays, timeZone);

    this.logger.log(`Ticket ${ticket}: Created at ${createdAt.format()}, Warning at ${warningDate.format()}, Breach at ${breachDate.format()}`);

    const warningJobId = `warning:${domain}_${ticket}`;
    await this.slaQueue.add(
      'warning',
      { ticket, domain },
      { delay: warningDate.diff(dayjs()), jobId: warningJobId },
    );
    // record scheduled job in database
    await this.scheduledJobsService.createJob({
      ticketId: ticket,
      domain,
      scheduleId,
      type: 'warning',
      executeAt: warningDate.toDate(),
      jobId: warningJobId,
    });

    const breachJobId = `breach:${domain}_${ticket}`;
    await this.slaQueue.add(
      'breach',
      { ticket, domain, onBreachTags },
      { delay: breachDate.diff(dayjs()), jobId: breachJobId },
    );
    await this.scheduledJobsService.createJob({
      ticketId: ticket,
      domain,
      scheduleId,
      type: 'breach',
      executeAt: breachDate.toDate(),
      jobId: breachJobId,
      onBreachTags: onBreachTags
    });

  }


 /**
   * Pause all SLA jobs for a ticket (Warning + Breach)
   */

  async pauseTicketJobs(ticket: string, domain: string) {
    const jobIds = [
      `warning:${domain}_${ticket}`,
      `breach:${domain}_${ticket}`,
    ];

    for (const jobId of jobIds) {
      await this.pauseJob(jobId);
    }

    this.logger.log(`Paused SLA jobs for ticket ${ticket}`);
  }
/**
   * Resume all paused SLA jobs for a ticket
   */
async resumeTicketJobs(ticket: string, domain: string) {
  const jobs = await this.scheduledJobsService.findTicketJobs(ticket, domain);

  for (const job of jobs) {
   if (job.status === 'paused' && job.remainingDelayMs != null && job.remainingDelayMs > 0) {
  const remaining = job.remainingDelayMs; // ✅ now guaranteed number

  const now = Date.now();
  const newExecuteAt = new Date(now + remaining);

  await this.slaQueue.add(
    job.type,
    {
      ticket: job.ticketId,
      domain: job.domain,
      onBreachTags: job.breachTags,
    },
    {
      delay: remaining,
      jobId: job.jobId,
    },
  );

  await this.scheduledJobsService.updateJobFields(job.jobId, {
    remainingDelayMs: null,
    pausedAt: null,
    status: 'pending',
    executeAt: newExecuteAt,
  });
}
  }

  this.logger.log(`Resumed SLA jobs for ticket ${ticket}`);
}


   /**
   * Pause a single job: calculate remaining time and remove from queue
   */
  private async pauseJob(jobId: string) {
    const job = await this.slaQueue.getJob(jobId);
    if (!job) return;

    // Calculate remaining delay
const remainingDelay = job.timestamp + (job.opts.delay ?? 0) - Date.now();
    // Remove job from queue
    await job.remove();

    // Save remaining delay in DB
    await this.scheduledJobsService.pauseJob(jobId, {
      remainingDelayMs: remainingDelay,
      pausedAt: new Date(),
    });

    this.logger.log(`Paused job ${jobId}, remaining delay: ${remainingDelay}ms`);
  }






  /**
   * Calculate SLA datetime based on schedule and holidays (forward)
   * Respects business hours, holidays, and closed days
   */
  private calculateSlaDate(
    start: dayjs.Dayjs,
    hoursToAdd: number,
    schedule: any,
    holidays: { start: dayjs.Dayjs; end: dayjs.Dayjs }[],
    timeZone: string,
  ): dayjs.Dayjs {
    let current = start;
    let minutesToAdd = hoursToAdd * 60; // Convert to minutes for precision with fractional hours

    while (minutesToAdd > 0) {
      const jsDay = current.day(); // JS: 0=Sunday
      const dbDay = (jsDay + 6) % 7; // convert JS 0=Sun -> 0=Mon
      const scheduleDay = schedule.days.find(d => d.dayOfWeek === dbDay);

      // Skip non-working days or holidays
      if (!scheduleDay?.isWorkingDay || this.isHoliday(current, holidays)) {
        // Move to next day at midnight
        current = current.add(1, 'day').startOf('day');
        continue;
      }

      // Today's working hours
      const [startH, startM] = scheduleDay.startTime.split(':').map(Number);
      const [endH, endM] = scheduleDay.endTime.split(':').map(Number);
      const dayStart = current.hour(startH).minute(startM).second(0);
      const dayEnd = current.hour(endH).minute(endM).second(0);

      // If current time is before business hours, move to start of business hours
      if (current.isBefore(dayStart)) {
        current = dayStart;
      }

      // If current time is after business hours, move to next day
      if (current.isAfter(dayEnd)) {
        current = current.add(1, 'day').startOf('day');
        continue;
      }

      // Calculate remaining minutes until end of business hours today
      const remainingMinutesToday = dayEnd.diff(current, 'millisecond') / (1000 * 60);

      if (minutesToAdd <= remainingMinutesToday) {
        // We can complete the SLA today
        return current.add(minutesToAdd, 'minute');
      } else {
        // Use up remaining time today and move to next day
        minutesToAdd -= remainingMinutesToday;
        current = dayEnd.add(1, 'day').startOf('day');
      }
    }

    return current;
  }

  /**
   * Calculate warning date by counting backward from breach
   * Respects business hours, holidays, and closed days
   */
  private calculateSlaDateBackwards(
    end: dayjs.Dayjs,
    hoursToSubtract: number,
    schedule: any,
    holidays: { start: dayjs.Dayjs; end: dayjs.Dayjs }[],
    timeZone: string,
  ): dayjs.Dayjs {
    let current = end;
    let minutesToSubtract = hoursToSubtract * 60; // Convert to minutes for precision with fractional hours

    while (minutesToSubtract > 0) {
      const jsDay = current.day();
      const dbDay = (jsDay + 6) % 7;
      const scheduleDay = schedule.days.find(d => d.dayOfWeek === dbDay);

      // Skip non-working days or holidays
      if (!scheduleDay?.isWorkingDay || this.isHoliday(current, holidays)) {
        // Move to previous day end of business hours
        current = current.subtract(1, 'day').endOf('day');
        continue;
      }

      const [startH, startM] = scheduleDay.startTime.split(':').map(Number);
      const [endH, endM] = scheduleDay.endTime.split(':').map(Number);

      const dayStart = current.hour(startH).minute(startM).second(0);
      const dayEnd = current.hour(endH).minute(endM).second(0);

      // If current time is after business hours, move to end of business hours
      if (current.isAfter(dayEnd)) {
        current = dayEnd;
      }

      // If current time is before business hours, move to previous day
      if (current.isBefore(dayStart)) {
        current = current.subtract(1, 'day').endOf('day');
        continue;
      }

      // Calculate minutes worked from start of business hours to current time
      const minutesWorkedFromStart = current.diff(dayStart, 'millisecond') / (1000 * 60);

      if (minutesToSubtract <= minutesWorkedFromStart) {
        // We can subtract all remaining minutes from today
        return current.subtract(minutesToSubtract, 'minute');
      } else {
        // Subtract today's available minutes and move to previous day
        minutesToSubtract -= minutesWorkedFromStart;
        current = dayStart.subtract(1, 'day').endOf('day');
      }
    }

    return current;
  }

  /**
   * Check if a date falls within a holiday period
   */
  private isHoliday(date: dayjs.Dayjs, holidays: { start: dayjs.Dayjs; end: dayjs.Dayjs }[]): boolean {
    const dateAtMidnight = date.startOf('day');
    return holidays.some(h => dateAtMidnight.isBetween(h.start, h.end, null, '[]'));
  }

  /**
   * Validate if a timezone string is valid
   */
  private isValidTimeZone(tzStr: string): boolean {
    try {
      dayjs().tz(tzStr);
      return true; 
    } catch {
      return false;
    }
  }
}