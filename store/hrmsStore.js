import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { hrmsStorage } from '../services/database.web.js';
import { todayKey } from '../utils/timeCalculator';

const defaultSalary = (monthlySalary) => ({
  monthlySalary,
  calculationType: 'monthly',
  workingDaysPerMonth: 26,
  perDaySalary: monthlySalary / 26,
  perDaySalaryOverride: false,
  halfDaySalary: monthlySalary / 52,
  perHourSalary: monthlySalary / 208,
  overtimeRate: 150,
  paidLeaveSalary: monthlySalary / 26,
  unpaidLeaveDeduction: monthlySalary / 26,
  allowances: 2500,
  deductions: 500,
  lateDeduction: 100,
  earlyLogoutDeduction: 100,
  fullDayHours: 8,
  halfDayHours: 4,
});

const seedCompanies = [
  { id: 'c1', name: 'Attan Technologies', address: 'Bengaluru, Karnataka', email: 'hr@attan.co', phone: '+91 98765 43210', registration: 'ATT-2024-001', color: '#4F46E5', holidays: [], salaryPolicy: { payWeeklyOff: true, payPublicHoliday: true } },
  { id: 'c2', name: 'Attan Retail', address: 'Mumbai, Maharashtra', email: 'hello@attanretail.com', phone: '+91 91234 56780', registration: 'ATR-2024-018', color: '#0EA5E9', holidays: [], salaryPolicy: { payWeeklyOff: true, payPublicHoliday: true } },
  { id: 'c3', name: 'Aptara', address: '', email: '', phone: '', registration: '', color: '#4361EE', holidays: [], salaryPolicy: { payWeeklyOff: true, payPublicHoliday: true } },
];

const seedEmployees = [
  { id: 'e1', companyId: 'c1', name: 'Aarav Sharma', code: 'EMP-001', email: 'aarav@attan.co', phone: '+91 99888 11111', designation: 'Senior Developer', department: 'Engineering', joiningDate: '2024-01-15', status: 'active', shiftStart: '09:00', shiftEnd: '17:00', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'admin', salary: defaultSalary(85000) },
  { id: 'e2', companyId: 'c1', name: 'Diya Patel', code: 'EMP-002', email: 'diya@attan.co', phone: '+91 99888 22222', designation: 'HR Manager', department: 'Human Resources', joiningDate: '2024-03-01', status: 'active', shiftStart: '09:00', shiftEnd: '17:30', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'employee', salary: { ...defaultSalary(72000), overtimeRate: 180 } },
  { id: 'e3', companyId: 'c1', name: 'Kabir Singh', code: 'EMP-003', email: 'kabir@attan.co', phone: '+91 99888 33333', designation: 'UI/UX Designer', department: 'Design', joiningDate: '2024-05-20', status: 'active', shiftStart: '10:00', shiftEnd: '18:00', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'employee', salary: { ...defaultSalary(68000), overtimeRate: 160 } },
  { id: 'e4', companyId: 'c2', name: 'Meera Nair', code: 'EMP-101', email: 'meera@attanretail.com', phone: '+91 99888 44444', designation: 'Store Lead', department: 'Operations', joiningDate: '2023-11-10', status: 'active', shiftStart: '09:30', shiftEnd: '18:30', requiredHours: 9, weeklyOffs: [0], photo: '', role: 'employee', salary: { ...defaultSalary(54000), overtimeRate: 120 } },
  { id: 'e5', companyId: 'c3', name: 'Rahul Chauhan', code: 'MAS63478', email: '', phone: '', designation: '', department: 'Typesetting', joiningDate: '', status: 'active', shiftLabel: 'Day Shift', shiftStart: '', shiftEnd: '', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'employee', salary: defaultSalary(0) },
];

const validAttendanceStatuses = ['Present', 'Half Day', 'Absent', 'Paid Leave', 'Unpaid Leave', 'Weekly Off', 'Public Holiday'];

function attendanceEarnings(employee, company, status, overtimeHours) {
  const salary = employee.salary ?? {};
  const perDay = Number(salary.perDaySalary ?? 0);
  let attendance = 0;
  if (status === 'Present') attendance = perDay;
  if (status === 'Half Day') attendance = Number(salary.halfDaySalary ?? perDay / 2);
  if (status === 'Paid Leave') attendance = Number(salary.paidLeaveSalary ?? perDay);
  if (status === 'Weekly Off' && company?.salaryPolicy?.payWeeklyOff !== false) attendance = perDay;
  if (status === 'Public Holiday' && company?.salaryPolicy?.payPublicHoliday !== false) attendance = perDay;
  const overtime = Math.max(0, Number(overtimeHours) || 0) * Number(salary.overtimeRate ?? 0);
  return { attendance, overtime };
}

export const useHrmsStore = create(persist((set, get) => ({
  companies: seedCompanies,
  employees: seedEmployees,
  sessions: [],
  overtimeRequests: [],
  attendanceAdjustments: [],
  attendanceHistory: [],
  salaryTransactions: [],
  salaryPayments: [],
  salaryAdjustments: [],
  payroll: [],
  reminderIds: [],
  reminderTimes: ['18:00', '19:00', '20:00'],
  remindersEnabled: true,
  theme: 'light',
  activeCompanyId: 'c3',
  setTheme: (theme) => set({ theme }),
  addCompany: (company) => set((state) => ({ companies: [...state.companies, company] })),
  updateCompany: (company) => set((state) => ({ companies: state.companies.map((item) => item.id === company.id ? company : item) })),
  deleteCompany: (id) => set((state) => {
    const companies = state.companies.filter((item) => item.id !== id);
    return {
      companies,
      employees: state.employees.filter((item) => item.companyId !== id),
      sessions: state.sessions.filter((item) => item.companyId !== id),
      payroll: state.payroll.filter((item) => item.companyId !== id),
      overtimeRequests: state.overtimeRequests.filter((item) => state.employees.some((employee) => employee.id === item.employeeId && employee.companyId !== id)),
      attendanceAdjustments: state.attendanceAdjustments.filter((item) => state.employees.some((employee) => employee.id === item.employeeId && employee.companyId !== id)),
      attendanceHistory: state.attendanceHistory.filter((item) => state.employees.some((employee) => employee.id === item.employeeId && employee.companyId !== id)),
      salaryTransactions: state.salaryTransactions.filter((item) => item.companyId !== id),
      salaryPayments: state.salaryPayments.filter((item) => item.companyId !== id),
      salaryAdjustments: state.salaryAdjustments.filter((item) => item.companyId !== id),
      activeCompanyId: state.activeCompanyId === id ? companies[0]?.id ?? '' : state.activeCompanyId,
    };
  }),
  setActiveCompany: (id) => set({ activeCompanyId: id }),
  addEmployee: (employee) => set((state) => ({ employees: [...state.employees, employee] })),
  updateEmployee: (employee) => set((state) => ({ employees: state.employees.map((item) => item.id === employee.id ? employee : item) })),
  markAttendance: async (employeeId, date, status, note = '', overtimeHours = 0) => {
    const hours = Number(overtimeHours);
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validAttendanceStatuses.includes(status) || !Number.isFinite(hours) || hours < 0 || hours > 24) {
      throw new Error('Provide a valid employee, date, and overtime value from 0 to 24 hours.');
    }
    set((current) => {
      const employee = current.employees.find((item) => item.id === employeeId);
      if (!employee) throw new Error('The selected employee no longer exists.');
      const company = current.companies.find((item) => item.id === employee.companyId);
      const existing = current.attendanceAdjustments.find((item) => item.employeeId === employeeId && item.date === date);
      const normalizedNote = String(note ?? '').trim();
      const nextHours = Math.round(hours * 100) / 100;
      if (existing?.status === status && existing.note === normalizedNote && Number(existing.overtimeHours ?? 0) === nextHours) return current;

      const now = Date.now();
      const earnings = attendanceEarnings(employee, company, status, nextHours);
      const adjustment = {
        id: existing?.id ?? `adj-${employeeId}-${date}`,
        employeeId,
        date,
        status,
        note: normalizedNote,
        overtimeHours: nextHours,
        salaryEarnings: earnings.attendance,
        overtimeEarnings: earnings.overtime,
        updatedAt: now,
        previousStatus: existing?.status ?? null,
      };
      const salaryId = `attendance-${employeeId}-${date}`;
      const overtimeId = `overtime-${employeeId}-${date}`;
      const withoutDay = current.salaryTransactions.filter((item) => item.id !== salaryId && item.id !== overtimeId);
      const transactions = [
        ...withoutDay,
        ...(earnings.attendance > 0 ? [{
          id: salaryId,
          employeeId,
          companyId: employee.companyId,
          attendanceDate: date,
          transactionDate: now,
          type: 'attendance-credit',
          description: `${status} salary · ${date}`,
          amount: earnings.attendance,
        }] : []),
        ...(earnings.overtime > 0 ? [{
          id: overtimeId,
          employeeId,
          companyId: employee.companyId,
          attendanceDate: date,
          transactionDate: now,
          type: 'overtime-credit',
          description: `${nextHours}h overtime · ${date}`,
          amount: earnings.overtime,
          hours: nextHours,
        }] : []),
      ];
      const history = {
        id: `history-${employeeId}-${date}-${now}`,
        employeeId,
        date,
        changedAt: now,
        previousStatus: existing?.status ?? null,
        status,
        previousOvertimeHours: Number(existing?.overtimeHours ?? 0),
        previousSalaryEarnings: Number(existing?.salaryEarnings ?? 0),
        salaryEarnings: earnings.attendance,
        previousOvertimeEarnings: Number(existing?.overtimeEarnings ?? 0),
        overtimeEarnings: earnings.overtime,
        overtimeHours: nextHours,
        note: normalizedNote,
      };
      return {
        attendanceAdjustments: [
          ...current.attendanceAdjustments.filter((item) => item.id !== adjustment.id),
          adjustment,
        ],
        attendanceHistory: [...current.attendanceHistory, history],
        salaryTransactions: transactions,
      };
    });
  },
  deleteAttendance: async (employeeId, date) => set((current) => {
    const existing = current.attendanceAdjustments.find((item) => item.employeeId === employeeId && item.date === date);
    if (!existing) return current;
    const now = Date.now();
    return {
      attendanceAdjustments: current.attendanceAdjustments.filter((item) => item.id !== existing.id),
      attendanceHistory: [...current.attendanceHistory, {
        id: `history-${employeeId}-${date}-${now}`,
        employeeId,
        date,
        changedAt: now,
        previousStatus: existing.status,
        status: 'Deleted',
        previousOvertimeHours: Number(existing.overtimeHours ?? 0),
        previousSalaryEarnings: Number(existing.salaryEarnings ?? 0),
        salaryEarnings: 0,
        previousOvertimeEarnings: Number(existing.overtimeEarnings ?? 0),
        overtimeEarnings: 0,
        overtimeHours: 0,
        note: existing.note,
      }],
      salaryTransactions: current.salaryTransactions.filter((item) => item.id !== `attendance-${employeeId}-${date}` && item.id !== `overtime-${employeeId}-${date}`),
    };
  }),
  recordSalaryPayment: async (employeeId, amount, note = '') => set((current) => {
    const employee = current.employees.find((item) => item.id === employeeId);
    const paymentAmount = Number(amount);
    if (!employee || !Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Choose an employee and enter a payment greater than zero.');
    const availableBalance = current.salaryTransactions
      .filter((item) => item.employeeId === employeeId)
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    if (paymentAmount > availableBalance) throw new Error('Payment cannot exceed the employee contribution balance.');
    const now = Date.now();
    const id = `payment-${employeeId}-${now}-${current.salaryPayments.length}`;
    const payment = { id, employeeId, companyId: employee.companyId, amount: paymentAmount, note: String(note ?? '').trim(), paidAt: now };
    const transaction = {
      id,
      employeeId,
      companyId: employee.companyId,
      attendanceDate: todayKey(),
      transactionDate: now,
      type: 'salary-payment',
      description: payment.note || `Salary payment · ${todayKey()}`,
      amount: -paymentAmount,
    };
    return {
      salaryPayments: [...current.salaryPayments, payment],
      salaryTransactions: [...current.salaryTransactions, transaction],
    };
  }),
  deleteEmployee: (id) => set((state) => ({
    employees: state.employees.filter((item) => item.id !== id),
    sessions: state.sessions.filter((item) => item.employeeId !== id),
    overtimeRequests: state.overtimeRequests.filter((item) => item.employeeId !== id),
    payroll: state.payroll.filter((item) => item.employeeId !== id),
    attendanceAdjustments: state.attendanceAdjustments.filter((item) => item.employeeId !== id),
    attendanceHistory: state.attendanceHistory.filter((item) => item.employeeId !== id),
    salaryTransactions: state.salaryTransactions.filter((item) => item.employeeId !== id),
    salaryPayments: state.salaryPayments.filter((item) => item.employeeId !== id),
    salaryAdjustments: state.salaryAdjustments.filter((item) => item.employeeId !== id),
  })),
  setReminderIds: (reminderIds) => set({ reminderIds }),
  setReminderTimes: (reminderTimes) => set({ reminderTimes }),
  setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
  activeSessionFor: (employeeId) => get().sessions.find((session) => session.employeeId === employeeId && session.date === todayKey() && session.status !== 'clocked-out'),
  clockIn: async (employeeId) => {
    const state = get();
    const employee = state.employees.find((item) => item.id === employeeId);
    if (!employee || state.sessions.some((session) => session.employeeId === employeeId && session.date === todayKey())) return;
    const now = Date.now();
    const session = {
      id: `a-${now}`,
      employeeId,
      companyId: employee.companyId,
      date: todayKey(),
      clockInAt: now,
      activeWorkStartedAt: now,
      clockOutAt: null,
      workMs: 0,
      breaks: [],
      status: 'working',
      overrideStatus: null,
    };
    set({ sessions: [...get().sessions, session] });
  },
  startBreak: (employeeId) => set((state) => ({
    sessions: state.sessions.map((session) => {
      if (session.employeeId !== employeeId || session.date !== todayKey() || session.status !== 'working') return session;
      const now = Date.now();
      return {
        ...session,
        workMs: session.workMs + Math.max(0, now - session.activeWorkStartedAt),
        activeWorkStartedAt: null,
        status: 'break',
        breaks: [...session.breaks, { id: `b-${now}`, startAt: now, endAt: null }],
      };
    }),
  })),
  resumeWork: (employeeId) => set((state) => ({
    sessions: state.sessions.map((session) => {
      if (session.employeeId !== employeeId || session.date !== todayKey() || session.status !== 'break') return session;
      const now = Date.now();
      return {
        ...session,
        status: 'working',
        activeWorkStartedAt: now,
        breaks: session.breaks.map((item, index) => index === session.breaks.length - 1 ? { ...item, endAt: now } : item),
      };
    }),
  })),
  clockOut: (employeeId) => set((state) => {
    let completedOvertime = 0;
    let actualOvertime = 0;
    let completedSession = null;
    const sessions = state.sessions.map((session) => {
      if (session.employeeId !== employeeId || session.date !== todayKey() || session.status === 'clocked-out') return session;
      const now = Date.now();
      const working = session.status === 'working';
      const employee = state.employees.find((item) => item.id === employeeId);
      const workMs = session.workMs + (working ? Math.max(0, now - session.activeWorkStartedAt) : 0);
      actualOvertime = Math.max(0, workMs / 3600000 - (employee?.requiredHours ?? 0));
      completedSession = {
        ...session,
        status: 'clocked-out',
        clockOutAt: now,
        activeWorkStartedAt: null,
        workMs,
        breaks: !working && session.breaks.length
          ? session.breaks.map((item, index) => index === session.breaks.length - 1 && !item.endAt ? { ...item, endAt: now } : item)
          : session.breaks,
      };
      return completedSession;
    });
    const overtimeRequests = state.overtimeRequests.map((item) => {
      if (item.employeeId !== employeeId || item.date !== todayKey() || item.status !== 'approved') return item;
      const approvedHours = item.approvedHours ?? item.requestedHours;
      const completedHours = Math.min(approvedHours, Math.max(0, actualOvertime - completedOvertime));
      completedOvertime += completedHours;
      return { ...item, completedHours, extraHours: Math.max(0, actualOvertime - completedOvertime) };
    });
    if (!completedSession) return { sessions, overtimeRequests };
    const employee = state.employees.find((item) => item.id === employeeId);
    const company = state.companies.find((item) => item.id === completedSession.companyId);
    const existing = state.attendanceAdjustments.find((item) => item.employeeId === employeeId && item.date === todayKey());
    if (!employee) return { sessions, overtimeRequests };

    const workedHours = completedSession.workMs / 3600000;
    const fullDayHours = Number(employee.salary?.fullDayHours ?? employee.requiredHours ?? 8);
    const halfDayHours = Number(employee.salary?.halfDayHours ?? 4);
    const status = existing?.status ?? (workedHours >= fullDayHours ? 'Present' : workedHours >= halfDayHours ? 'Half Day' : 'Absent');
    const overtimeHours = Math.round((completedOvertime || Number(existing?.overtimeHours ?? 0)) * 100) / 100;
    const earnings = attendanceEarnings(employee, company, status, overtimeHours);
    const now = completedSession.clockOutAt;
    const adjustment = {
      ...existing,
      id: `adj-${employeeId}-${todayKey()}`,
      employeeId,
      date: todayKey(),
      status,
      note: existing?.note || 'Attendance calculated from completed shift.',
      overtimeHours,
      salaryEarnings: earnings.attendance,
      overtimeEarnings: earnings.overtime,
      updatedAt: now,
    };
    const salaryId = `attendance-${employeeId}-${todayKey()}`;
    const overtimeId = `overtime-${employeeId}-${todayKey()}`;
    const salaryTransactions = state.salaryTransactions.filter((item) => item.id !== salaryId && item.id !== overtimeId);
    if (earnings.attendance > 0) salaryTransactions.push({
      id: salaryId,
      employeeId,
      companyId: employee.companyId,
      attendanceDate: todayKey(),
      transactionDate: now,
      type: 'attendance-credit',
      description: `${status} salary · ${todayKey()}`,
      amount: earnings.attendance,
    });
    if (earnings.overtime > 0) salaryTransactions.push({
      id: overtimeId,
      employeeId,
      companyId: employee.companyId,
      attendanceDate: todayKey(),
      transactionDate: now,
      type: 'overtime-credit',
      description: `${overtimeHours}h overtime · ${todayKey()}`,
      amount: earnings.overtime,
      hours: overtimeHours,
    });
    return {
      sessions,
      overtimeRequests,
      attendanceAdjustments: [...state.attendanceAdjustments.filter((item) => item.id !== adjustment.id), adjustment],
      attendanceHistory: [...state.attendanceHistory, {
        id: `history-${employeeId}-${todayKey()}-${now}`,
        employeeId,
        date: todayKey(),
        changedAt: now,
        previousStatus: existing?.status ?? null,
        status,
        previousOvertimeHours: Number(existing?.overtimeHours ?? 0),
        previousSalaryEarnings: Number(existing?.salaryEarnings ?? 0),
        salaryEarnings: earnings.attendance,
        previousOvertimeEarnings: Number(existing?.overtimeEarnings ?? 0),
        overtimeEarnings: earnings.overtime,
        overtimeHours,
        note: existing?.note || adjustment.note,
      }],
      salaryTransactions,
    };
  }),
  requestOvertime: (employeeId, hours) => set((state) => ({
    overtimeRequests: [...state.overtimeRequests, { id: `ot-${Date.now()}`, employeeId, date: todayKey(), requestedHours: hours, approvedHours: 0, completedHours: 0, extraHours: 0, status: 'pending' }],
  })),
  setOvertimeStatus: (requestId, status) => set((state) => ({
    overtimeRequests: state.overtimeRequests.map((item) => item.id === requestId
      ? { ...item, status, approvedHours: status === 'approved' ? item.requestedHours : 0, completedHours: 0 }
      : item),
  })),
}), {
  name: 'attan-hrms',
  storage: createJSONStorage(() => hrmsStorage),
  merge: (persistedState, currentState) => {
    const saved = persistedState ?? {};
    const companies = saved.companies ?? currentState.companies;
    const employees = saved.employees ?? currentState.employees;
    if (!companies.some((company) => company.id === 'c3')) companies.push(seedCompanies[2]);
    if (!employees.some((employee) => employee.code === 'MAS63478')) employees.push(seedEmployees[4]);
    let salaryTransactions = saved.salaryTransactions;
    if (!salaryTransactions) {
      salaryTransactions = [];
      const adjustments = saved.attendanceAdjustments ?? [];
      const adjustedDays = new Set(adjustments.map((item) => `${item.employeeId}:${item.date}`));
      const addCredits = (employee, date, status, overtimeHours, timestamp) => {
        const company = (saved.companies ?? seedCompanies).find((item) => item.id === employee.companyId);
        const earnings = attendanceEarnings(employee, company, status, overtimeHours);
        const common = { employeeId: employee.id, companyId: employee.companyId, attendanceDate: date, transactionDate: timestamp };
        if (earnings.attendance > 0) salaryTransactions.push({
          ...common,
          id: `attendance-${employee.id}-${date}`,
          type: 'attendance-credit',
          description: `${status} salary · ${date}`,
          amount: earnings.attendance,
        });
        if (earnings.overtime > 0) salaryTransactions.push({
          ...common,
          id: `overtime-${employee.id}-${date}`,
          type: 'overtime-credit',
          description: `${overtimeHours}h overtime · ${date}`,
          amount: earnings.overtime,
          hours: overtimeHours,
        });
      };
      adjustments.forEach((item) => {
        const employee = (saved.employees ?? seedEmployees).find((person) => person.id === item.employeeId);
        if (employee && validAttendanceStatuses.includes(item.status)) addCredits(employee, item.date, item.status, Number(item.overtimeHours ?? 0), item.updatedAt ?? Date.now());
      });
      (saved.sessions ?? []).filter((item) => item.status === 'clocked-out' && !adjustedDays.has(`${item.employeeId}:${item.date}`)).forEach((session) => {
        const employee = (saved.employees ?? seedEmployees).find((person) => person.id === session.employeeId);
        if (!employee) return;
        const hours = Number(session.workMs ?? 0) / 3600000;
        const status = hours >= Number(employee.salary?.fullDayHours ?? employee.requiredHours ?? 8)
          ? 'Present'
          : hours >= Number(employee.salary?.halfDayHours ?? 4) ? 'Half Day' : 'Absent';
        const overtimeHours = (saved.overtimeRequests ?? [])
          .filter((item) => item.employeeId === employee.id && item.date === session.date && item.status === 'approved')
          .reduce((sum, item) => sum + Number(item.completedHours ?? 0), 0);
        addCredits(employee, session.date, status, overtimeHours, session.clockOutAt ?? Date.now());
      });
    }
    return {
      ...currentState,
      ...saved,
      companies,
      employees,
      activeCompanyId: saved.activeCompanyId ?? currentState.activeCompanyId,
      attendanceAdjustments: saved.attendanceAdjustments ?? [],
      attendanceHistory: saved.attendanceHistory ?? [],
      salaryTransactions,
      salaryPayments: saved.salaryPayments ?? [],
      reminderTimes: saved.reminderTimes ?? ['18:00', '19:00', '20:00'],
      salaryAdjustments: saved.salaryAdjustments ?? [],
      remindersEnabled: saved.remindersEnabled ?? true,
    };
  },
  partialize: (state) => ({
    companies: state.companies,
    employees: state.employees,
    sessions: state.sessions,
    overtimeRequests: state.overtimeRequests,
    attendanceAdjustments: state.attendanceAdjustments,
    attendanceHistory: state.attendanceHistory,
    salaryTransactions: state.salaryTransactions,
    salaryPayments: state.salaryPayments,
    salaryAdjustments: state.salaryAdjustments,
    payroll: state.payroll,
    reminderIds: state.reminderIds,
    reminderTimes: state.reminderTimes,
    remindersEnabled: state.remindersEnabled,
    activeCompanyId: state.activeCompanyId,
    theme: state.theme,
  }),
}));
