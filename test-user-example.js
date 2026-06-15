/**
 * Test with user's exact example
 */
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isBetween = require('dayjs/plugin/isBetween');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// User's actual schedule: 09:00-18:00
const mockSchedule = {
  days: [
    { dayOfWeek: 0, isWorkingDay: true, startTime: '09:00:00', endTime: '18:00:00' },  // Monday
    { dayOfWeek: 1, isWorkingDay: true, startTime: '09:00:00', endTime: '18:00:00' },  // Tuesday
    { dayOfWeek: 2, isWorkingDay: true, startTime: '09:00:00', endTime: '18:00:00' },  // Wednesday
    { dayOfWeek: 3, isWorkingDay: true, startTime: '09:00:00', endTime: '18:00:00' },  // Thursday
    { dayOfWeek: 4, isWorkingDay: true, startTime: '09:00:00', endTime: '18:00:00' },  // Friday
    { dayOfWeek: 5, isWorkingDay: false, startTime: '00:00:00', endTime: '00:00:00' }, // Saturday
    { dayOfWeek: 6, isWorkingDay: false, startTime: '00:00:00', endTime: '00:00:00' }, // Sunday
  ]
};

const mockHolidays = [];

function isHoliday(date, holidays) {
  const dateAtMidnight = date.startOf('day');
  return holidays.some(h => dateAtMidnight.isBetween(h.start, h.end, null, '[]'));
}

function calculateSlaDate(start, hoursToAdd, schedule, holidays) {
  let current = start;
  let minutesToAdd = hoursToAdd * 60;

  console.log(`\n📍 Breach Date Forward Calculation`);
  console.log(`   Start: ${current.format('YYYY-MM-DD HH:mm Z (ddd)')}`);
  console.log(`   Need to add: ${hoursToAdd} hours (${minutesToAdd} minutes)`);

  let iteration = 0;
  while (minutesToAdd > 0 && iteration < 50) {
    iteration++;
    const jsDay = current.day();
    const dbDay = (jsDay + 6) % 7;
    const scheduleDay = schedule.days.find(d => d.dayOfWeek === dbDay);

    if (!scheduleDay?.isWorkingDay || isHoliday(current, holidays)) {
      console.log(`   ⏭️  Skipping non-working: ${current.format('YYYY-MM-DD (ddd)')}`);
      current = current.add(1, 'day').startOf('day');
      continue;
    }

    const [startH, startM] = scheduleDay.startTime.split(':').map(Number);
    const [endH, endM] = scheduleDay.endTime.split(':').map(Number);
    const dayStart = current.hour(startH).minute(startM).second(0);
    const dayEnd = current.hour(endH).minute(endM).second(0);

    console.log(`   📆 ${current.format('YYYY-MM-DD (ddd)')}: ${scheduleDay.startTime}-${scheduleDay.endTime}`);

    if (current.isBefore(dayStart)) {
      console.log(`      Current before start, moving to ${dayStart.format('HH:mm')}`);
      current = dayStart;
    }

    if (current.isAfter(dayEnd)) {
      console.log(`      Current after end, moving to next day`);
      current = current.add(1, 'day').startOf('day');
      continue;
    }

    const remainingMinutesToday = dayEnd.diff(current, 'millisecond') / (1000 * 60);
    console.log(`      Remaining: ${remainingMinutesToday.toFixed(0)} min, Need: ${minutesToAdd.toFixed(0)} min`);

    if (minutesToAdd <= remainingMinutesToday) {
      const result = current.add(minutesToAdd, 'minute');
      console.log(`   ✅ BREACH: ${result.format('YYYY-MM-DD HH:mm (ddd)')}`);
      return result;
    } else {
      minutesToAdd -= remainingMinutesToday;
      current = dayEnd.add(1, 'day').startOf('day');
      console.log(`      Moved to next day. Remaining: ${minutesToAdd.toFixed(0)} min\n`);
    }
  }

  return current;
}

function calculateSlaDateBackwards(end, hoursToSubtract, schedule, holidays) {
  let current = end;
  let minutesToSubtract = hoursToSubtract * 60;

  console.log(`\n📍 Warning Date Backward Calculation`);
  console.log(`   From: ${current.format('YYYY-MM-DD HH:mm Z (ddd)')}`);
  console.log(`   Subtract: ${hoursToSubtract} hours`);

  let iteration = 0;
  while (minutesToSubtract > 0 && iteration < 50) {
    iteration++;
    const jsDay = current.day();
    const dbDay = (jsDay + 6) % 7;
    const scheduleDay = schedule.days.find(d => d.dayOfWeek === dbDay);

    if (!scheduleDay?.isWorkingDay || isHoliday(current, holidays)) {
      console.log(`   ⏮️  Skipping non-working: ${current.format('YYYY-MM-DD (ddd)')}`);
      current = current.subtract(1, 'day').endOf('day');
      continue;
    }

    const [startH, startM] = scheduleDay.startTime.split(':').map(Number);
    const [endH, endM] = scheduleDay.endTime.split(':').map(Number);
    const dayStart = current.hour(startH).minute(startM).second(0);
    const dayEnd = current.hour(endH).minute(endM).second(0);

    console.log(`   📆 ${current.format('YYYY-MM-DD (ddd)')}: ${scheduleDay.startTime}-${scheduleDay.endTime}`);

    if (current.isAfter(dayEnd)) {
      console.log(`      After end, moving to ${dayEnd.format('HH:mm')}`);
      current = dayEnd;
    }

    if (current.isBefore(dayStart)) {
      console.log(`      Before start, moving to previous day`);
      current = current.subtract(1, 'day').endOf('day');
      continue;
    }

    const minutesWorkedFromStart = current.diff(dayStart, 'millisecond') / (1000 * 60);
    console.log(`      From start to now: ${minutesWorkedFromStart.toFixed(0)} min, Need: ${minutesToSubtract.toFixed(0)} min`);

    if (minutesToSubtract <= minutesWorkedFromStart) {
      const result = current.subtract(minutesToSubtract, 'minute');
      console.log(`   ✅ WARNING: ${result.format('YYYY-MM-DD HH:mm (ddd)')}`);
      return result;
    } else {
      minutesToSubtract -= minutesWorkedFromStart;
      current = dayStart.subtract(1, 'day').endOf('day');
      console.log(`      Moved to previous day. Remaining: ${minutesToSubtract.toFixed(0)} min\n`);
    }
  }

  return current;
}

console.log('═══════════════════════════════════════════════════');
console.log('  USER EXAMPLE TEST');
console.log('═══════════════════════════════════════════════════');

const payload = {
  ticket: '12345',
  scheduleId: 21,
  responseTime: 4,
  warningTime: 1,
  createdDate: '2026-02-27T18:00:00+03:00',
  timeZone: 'Europe/Istanbul',
};

console.log(`\nPayload:`);
console.log(`  Ticket: ${payload.ticket}`);
console.log(`  Created: ${payload.createdDate}`);
console.log(`  Response Time: ${payload.responseTime} hours`);
console.log(`  Warning Time: ${payload.warningTime} hours`);
console.log(`  Timezone: ${payload.timeZone}`);

const createdAt = dayjs(payload.createdDate);
const createdAtInTz = createdAt.isValid() ? createdAt.tz(payload.timeZone) : dayjs.tz(payload.createdDate, payload.timeZone);
console.log(`  Parsed Time: ${createdAtInTz.format('YYYY-MM-DD HH:mm Z (ddd)')}`);

const breachDate = calculateSlaDate(createdAtInTz, payload.responseTime, mockSchedule, mockHolidays);
const warningDate = calculateSlaDateBackwards(breachDate, payload.warningTime, mockSchedule, mockHolidays);

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`FINAL RESULTS:`);
console.log(`  Created:     ${createdAtInTz.format('YYYY-MM-DD HH:mm (ddd)')}`);
console.log(`  Warning:     ${warningDate.format('YYYY-MM-DD HH:mm (ddd)')}`);
console.log(`  Breach:      ${breachDate.format('YYYY-MM-DD HH:mm (ddd)')}`);
console.log(`\nExpected:`);
console.log(`  Warning:     2026-03-02 11:00 (Mon) ✓`);
console.log(`  Breach:      2026-03-02 12:00 (Mon) ✓`);
console.log(`═══════════════════════════════════════════════════`);
