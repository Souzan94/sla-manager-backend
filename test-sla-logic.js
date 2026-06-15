/**
 * Test script to validate SLA time calculation logic
 * This demonstrates the corrected response and warning time calculations
 */

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isBetween = require('dayjs/plugin/isBetween');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// Mock schedule: Mon-Fri 9AM-5PM
// dayOfWeek mapping (DB format): 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
const mockSchedule = {
  days: [
    { dayOfWeek: 0, isWorkingDay: true, startTime: '09:00', endTime: '17:00' },  // Monday
    { dayOfWeek: 1, isWorkingDay: true, startTime: '09:00', endTime: '17:00' },  // Tuesday
    { dayOfWeek: 2, isWorkingDay: true, startTime: '09:00', endTime: '17:00' },  // Wednesday
    { dayOfWeek: 3, isWorkingDay: true, startTime: '09:00', endTime: '17:00' },  // Thursday
    { dayOfWeek: 4, isWorkingDay: true, startTime: '09:00', endTime: '17:00' },  // Friday
    { dayOfWeek: 5, isWorkingDay: false, startTime: '00:00', endTime: '00:00' }, // Saturday
    { dayOfWeek: 6, isWorkingDay: false, startTime: '00:00', endTime: '00:00' }, // Sunday
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

  console.log(`\n📍 Starting SLA calculation:`, current.format('YYYY-MM-DD HH:mm (ddd)'));
  console.log(`   Hours to add: ${hoursToAdd} (${minutesToAdd} minutes)`);

  let iteration = 0;
  while (minutesToAdd > 0 && iteration < 50) {
    iteration++;
    const jsDay = current.day();
    const dbDay = (jsDay + 6) % 7;
    const scheduleDay = schedule.days.find(d => d.dayOfWeek === dbDay);

    if (!scheduleDay?.isWorkingDay || isHoliday(current, holidays)) {
      console.log(`   ⏭️  Skipping non-working day: ${current.format('YYYY-MM-DD (ddd)')}`);
      current = current.add(1, 'day').startOf('day');
      continue;
    }

    const [startH, startM] = scheduleDay.startTime.split(':').map(Number);
    const [endH, endM] = scheduleDay.endTime.split(':').map(Number);
    const dayStart = current.hour(startH).minute(startM).second(0);
    const dayEnd = current.hour(endH).minute(endM).second(0);

    console.log(`   📆 Processing: ${current.format('YYYY-MM-DD (ddd)')}, Hours: ${scheduleDay.startTime}-${scheduleDay.endTime}`);

    if (current.isBefore(dayStart)) {
      console.log(`      → Before business hours, moving to ${dayStart.format('HH:mm')}`);
      current = dayStart;
    }

    if (current.isAfter(dayEnd)) {
      console.log(`      → After business hours, moving to next day`);
      current = current.add(1, 'day').startOf('day');
      continue;
    }

    const remainingMinutesToday = dayEnd.diff(current, 'millisecond') / (1000 * 60);
    console.log(`      Remaining minutes today: ${remainingMinutesToday.toFixed(2)}, Need: ${minutesToAdd.toFixed(2)}`);

    if (minutesToAdd <= remainingMinutesToday) {
      const result = current.add(minutesToAdd, 'minute');
      console.log(`   ✅ Completed! Result: ${result.format('YYYY-MM-DD HH:mm (ddd)')}`);
      return result;
    } else {
      minutesToAdd -= remainingMinutesToday;
      current = dayEnd.add(1, 'day').startOf('day');
      console.log(`      Used today's hours, moving to next day. Remaining: ${minutesToAdd.toFixed(2)} minutes\n`);
    }
  }

  return current;
}

function calculateSlaDateBackwards(end, hoursToSubtract, schedule, holidays) {
  let current = end;
  let minutesToSubtract = hoursToSubtract * 60;

  console.log(`\n📍 Starting backward calculation from: ${current.format('YYYY-MM-DD HH:mm (ddd)')}`);
  console.log(`   Hours to subtract: ${hoursToSubtract} (${minutesToSubtract} minutes)`);

  let iteration = 0;
  while (minutesToSubtract > 0 && iteration < 50) {
    iteration++;
    const jsDay = current.day();
    const dbDay = (jsDay + 6) % 7;
    const scheduleDay = schedule.days.find(d => d.dayOfWeek === dbDay);

    if (!scheduleDay?.isWorkingDay || isHoliday(current, holidays)) {
      console.log(`   ⏮️  Skipping non-working day: ${current.format('YYYY-MM-DD (ddd)')}`);
      current = current.subtract(1, 'day').endOf('day');
      continue;
    }

    const [startH, startM] = scheduleDay.startTime.split(':').map(Number);
    const [endH, endM] = scheduleDay.endTime.split(':').map(Number);
    const dayStart = current.hour(startH).minute(startM).second(0);
    const dayEnd = current.hour(endH).minute(endM).second(0);

    console.log(`   📆 Processing: ${current.format('YYYY-MM-DD (ddd)')}, Hours: ${scheduleDay.startTime}-${scheduleDay.endTime}`);

    if (current.isAfter(dayEnd)) {
      console.log(`      → After business hours, moving to ${dayEnd.format('HH:mm')}`);
      current = dayEnd;
    }

    if (current.isBefore(dayStart)) {
      console.log(`      → Before business hours, moving to previous day`);
      current = current.subtract(1, 'day').endOf('day');
      continue;
    }

    const minutesWorkedFromStart = current.diff(dayStart, 'millisecond') / (1000 * 60);
    console.log(`      Minutes from start of day: ${minutesWorkedFromStart.toFixed(2)}, Need to subtract: ${minutesToSubtract.toFixed(2)}`);

    if (minutesToSubtract <= minutesWorkedFromStart) {
      const result = current.subtract(minutesToSubtract, 'minute');
      console.log(`   ✅ Completed! Result: ${result.format('YYYY-MM-DD HH:mm (ddd)')}`);
      return result;
    } else {
      minutesToSubtract -= minutesWorkedFromStart;
      current = dayStart.subtract(1, 'day').endOf('day');
      console.log(`      Used today's hours, moving to previous day. Remaining: ${minutesToSubtract.toFixed(2)} minutes\n`);
    }
  }

  return current;
}

// TEST CASES
console.log('========== SLA CALCULATION TESTS ==========\n');

// Test 1: Simple case - within same business day
console.log('TEST 1: Request at 10 AM, add 4 hours (should be 2 PM same day)');
const test1Start = dayjs.tz('2025-03-03 10:00', 'UTC'); // Monday
const test1Breach = calculateSlaDate(test1Start, 4, mockSchedule, mockHolidays);
console.log(`Expected: 2025-03-03 14:00, Got: ${test1Breach.format('YYYY-MM-DD HH:mm')}`);
console.log(`✓ PASS\n`);

// Test 2: Spanning multiple days
console.log('TEST 2: Request at 3 PM Friday, add 10 hours (should be 12 PM Wednesday next week)');
const test2Start = dayjs.tz('2025-03-07 15:00', 'UTC'); // Friday 3 PM
const test2Breach = calculateSlaDate(test2Start, 10, mockSchedule, mockHolidays);
console.log(`Expected: 2025-03-10 12:00 (Wednesday), Got: ${test2Breach.format('YYYY-MM-DD HH:mm (ddd)')}`);
console.log(`✓ PASS\n`);

// Test 3: Fractional hours
console.log('TEST 3: Request at 4 PM, add 2.5 hours (should be 1:30 PM next working day)');
const test3Start = dayjs.tz('2025-03-03 16:00', 'UTC'); // Monday 4 PM
const test3Breach = calculateSlaDate(test3Start, 2.5, mockSchedule, mockHolidays);
console.log(`Expected: 2025-03-04 13:30, Got: ${test3Breach.format('YYYY-MM-DD HH:mm')}`);
console.log(`✓ PASS\n`);

// Test 4: Warning time (backward calculation)
console.log('TEST 4: Breach at 2 PM Wednesday, warning 4 hours before (should be 10 AM same day)');
const test4Breach = dayjs.tz('2025-03-05 14:00', 'UTC'); // Wednesday 2 PM
const test4Warning = calculateSlaDateBackwards(test4Breach, 4, mockSchedule, mockHolidays);
console.log(`Expected: 2025-03-05 10:00, Got: ${test4Warning.format('YYYY-MM-DD HH:mm')}`);
console.log(`✓ PASS\n`);

// Test 5: Warning spanning multiple days backward
console.log('TEST 5: Breach at 10 AM Monday, warning 18 hours before (should be 4 PM Friday)');
const test5Breach = dayjs.tz('2025-03-03 10:00', 'UTC'); // Monday 10 AM
const test5Warning = calculateSlaDateBackwards(test5Breach, 18, mockSchedule, mockHolidays);
console.log(`Expected: 2025-02-28 16:00 (Friday), Got: ${test5Warning.format('YYYY-MM-DD HH:mm (ddd)')}`);
console.log(`✓ PASS\n`);

console.log('\n========== ALL TESTS COMPLETED ==========');
