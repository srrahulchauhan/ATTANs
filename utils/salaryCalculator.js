import { todayKey } from './timeCalculator';

export const attendanceStatuses = ['Present', 'Half Day', 'Absent', 'Paid Leave', 'Unpaid Leave', 'Weekly Off', 'Public Holiday'];

export function attendanceStatus(employee, workHours) {
  if (workHours >= employee.salary.fullDayHours) return 'Present';
  if (workHours >= employee.salary.halfDayHours) return 'Half Day';
  return 'Absent';
}

function isBeforeShiftEnd(employee, date) {
  const [hours, minutes] = employee.shiftEnd.split(':').map(Number);
  const shiftEnd = new Date(date);
  shiftEnd.setHours(hours, minutes, 0, 0);
  return Date.now() >= shiftEnd.getTime();
}

function addCount(counts, status) {
  if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
}

export function attendanceSummary(employee, sessions, adjustments, company, month, now = new Date()) {
  const counts = {
    Present: 0,
    'Half Day': 0,
    Absent: 0,
    'Paid Leave': 0,
    'Unpaid Leave': 0,
    'Weekly Off': 0,
    'Public Holiday': 0,
  };
  const dayStatuses = new Map();
  const monthSessions = sessions.filter((session) => session.employeeId === employee.id && session.date.startsWith(month));
  const monthAdjustments = adjustments.filter((item) => item.employeeId === employee.id && item.date.startsWith(month));

  for (const session of monthSessions) {
    const status = session.status === 'clocked-out'
      ? attendanceStatus(employee, session.workMs / 3600000)
      : 'Present';
    dayStatuses.set(session.date, status);
  }
  for (const adjustment of monthAdjustments) {
    dayStatuses.set(adjustment.date, adjustment.status);
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const today = todayKey(now);
  const firstEligibleDay = employee.joiningDate?.slice(0, 7) === month
    ? Number(employee.joiningDate.slice(8, 10))
    : 1;
  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (day < firstEligibleDay) continue;
    if (date > today) continue;
    const currentDay = new Date(year, monthNumber - 1, day);
    if (!dayStatuses.has(date)) {
      if (employee.weeklyOffs?.includes(currentDay.getDay())) {
        dayStatuses.set(date, 'Weekly Off');
      } else if (company?.holidays?.includes(date)) {
        dayStatuses.set(date, 'Public Holiday');
      } else if (date < today || isBeforeShiftEnd(employee, currentDay)) {
        dayStatuses.set(date, 'Absent');
      }
    }
  }

  for (const status of dayStatuses.values()) addCount(counts, status);

  const paidWeeklyOff = company?.salaryPolicy?.payWeeklyOff ? counts['Weekly Off'] : 0;
  const paidPublicHoliday = company?.salaryPolicy?.payPublicHoliday ? counts['Public Holiday'] : 0;
  const paidDays = counts.Present
    + counts['Half Day'] * 0.5
    + counts['Paid Leave']
    + paidWeeklyOff
    + paidPublicHoliday;
  const unpaidDayEquivalents = counts['Half Day'] * 0.5
    + counts.Absent
    + counts['Unpaid Leave']
    + (company?.salaryPolicy?.payWeeklyOff ? 0 : counts['Weekly Off'])
    + (company?.salaryPolicy?.payPublicHoliday ? 0 : counts['Public Holiday']);
  return { ...counts, paidDays, unpaidDayEquivalents };
}

export function calculatePayroll(employee, sessions, adjustments, overtimeRequests, salaryAdjustments, company, month) {
  const attendance = attendanceSummary(employee, sessions, adjustments, company, month);
  const salary = employee.salary;
  const perDaySalary = Number.isFinite(salary.perDaySalary)
    ? salary.perDaySalary
    : salary.monthlySalary / Math.max(1, salary.workingDaysPerMonth);
  const earnedSalary = perDaySalary * attendance.paidDays;
  const attendanceDeduction = perDaySalary * attendance.unpaidDayEquivalents;
  const approvedOvertime = overtimeRequests
    .filter((request) => request.employeeId === employee.id && request.date.startsWith(month) && request.status === 'approved')
    .reduce((hours, request) => hours + request.completedHours, 0);
  const overtimeEarnings = approvedOvertime * salary.overtimeRate;
  const manualAdjustments = salaryAdjustments
    .filter((adjustment) => adjustment.employeeId === employee.id && adjustment.month === month)
    .reduce((amount, adjustment) => amount + adjustment.amount, 0);
  const otherDeductions = salary.deductions;
  const allowances = salary.allowances;
  const netPayable = Math.max(0, earnedSalary + overtimeEarnings + allowances + manualAdjustments - otherDeductions);
  return {
    attendance,
    monthlySalary: salary.monthlySalary,
    workingDays: salary.workingDaysPerMonth,
    perDaySalary,
    halfDaySalary: perDaySalary / 2,
    earnedSalary,
    attendanceDeduction,
    overtimeHours: approvedOvertime,
    overtimeEarnings,
    allowances,
    otherDeductions,
    manualAdjustments,
    netPayable,
  };
}
