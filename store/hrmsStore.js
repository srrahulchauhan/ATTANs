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
];

const seedEmployees = [
  { id: 'e1', companyId: 'c1', name: 'Aarav Sharma', code: 'EMP-001', email: 'aarav@attan.co', phone: '+91 99888 11111', designation: 'Senior Developer', department: 'Engineering', joiningDate: '2024-01-15', status: 'active', shiftStart: '09:00', shiftEnd: '17:00', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'admin', salary: defaultSalary(85000) },
  { id: 'e2', companyId: 'c1', name: 'Diya Patel', code: 'EMP-002', email: 'diya@attan.co', phone: '+91 99888 22222', designation: 'HR Manager', department: 'Human Resources', joiningDate: '2024-03-01', status: 'active', shiftStart: '09:00', shiftEnd: '17:30', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'employee', salary: { ...defaultSalary(72000), overtimeRate: 180 } },
  { id: 'e3', companyId: 'c1', name: 'Kabir Singh', code: 'EMP-003', email: 'kabir@attan.co', phone: '+91 99888 33333', designation: 'UI/UX Designer', department: 'Design', joiningDate: '2024-05-20', status: 'active', shiftStart: '10:00', shiftEnd: '18:00', requiredHours: 8, weeklyOffs: [0], photo: '', role: 'employee', salary: { ...defaultSalary(68000), overtimeRate: 160 } },
  { id: 'e4', companyId: 'c2', name: 'Meera Nair', code: 'EMP-101', email: 'meera@attanretail.com', phone: '+91 99888 44444', designation: 'Store Lead', department: 'Operations', joiningDate: '2023-11-10', status: 'active', shiftStart: '09:30', shiftEnd: '18:30', requiredHours: 9, weeklyOffs: [0], photo: '', role: 'employee', salary: { ...defaultSalary(54000), overtimeRate: 120 } },
];

export const useHrmsStore = create(persist((set, get) => ({
  companies: seedCompanies,
  employees: seedEmployees,
  sessions: [],
  overtimeRequests: [],
  attendanceAdjustments: [],
  salaryAdjustments: [],
  payroll: [],
  reminderIds: [],
  remindersEnabled: true,
  theme: 'light',
  activeCompanyId: 'c1',
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
      salaryAdjustments: state.salaryAdjustments.filter((item) => item.companyId !== id),
      activeCompanyId: state.activeCompanyId === id ? companies[0]?.id ?? '' : state.activeCompanyId,
    };
  }),
  setActiveCompany: (id) => set({ activeCompanyId: id }),
  addEmployee: (employee) => set((state) => ({ employees: [...state.employees, employee] })),
  updateEmployee: (employee) => set((state) => ({ employees: state.employees.map((item) => item.id === employee.id ? employee : item) })),
  markAttendance: async (employeeId, date, status, note = '') => {
    const existing = get().attendanceAdjustments.find((item) => item.employeeId === employeeId && item.date === date);
    const adjustment = {
      id: existing?.id ?? `adj-${Date.now()}`,
      employeeId,
      date,
      status,
      note,
      updatedAt: Date.now(),
      previousStatus: existing?.status ?? null,
    };
    set((current) => ({
      attendanceAdjustments: [
        ...current.attendanceAdjustments.filter((item) => item.id !== adjustment.id),
        adjustment,
      ],
    }));
  },
  deleteEmployee: (id) => set((state) => ({
    employees: state.employees.filter((item) => item.id !== id),
    sessions: state.sessions.filter((item) => item.employeeId !== id),
    overtimeRequests: state.overtimeRequests.filter((item) => item.employeeId !== id),
    payroll: state.payroll.filter((item) => item.employeeId !== id),
    attendanceAdjustments: state.attendanceAdjustments.filter((item) => item.employeeId !== id),
    salaryAdjustments: state.salaryAdjustments.filter((item) => item.employeeId !== id),
  })),
  setReminderIds: (reminderIds) => set({ reminderIds }),
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
    const sessions = state.sessions.map((session) => {
      if (session.employeeId !== employeeId || session.date !== todayKey() || session.status === 'clocked-out') return session;
      const now = Date.now();
      const working = session.status === 'working';
      const employee = state.employees.find((item) => item.id === employeeId);
      const workMs = session.workMs + (working ? Math.max(0, now - session.activeWorkStartedAt) : 0);
      actualOvertime = Math.max(0, workMs / 3600000 - (employee?.requiredHours ?? 0));
      return {
        ...session,
        status: 'clocked-out',
        clockOutAt: now,
        activeWorkStartedAt: null,
        workMs,
        breaks: !working && session.breaks.length
          ? session.breaks.map((item, index) => index === session.breaks.length - 1 && !item.endAt ? { ...item, endAt: now } : item)
          : session.breaks,
      };
    });
    const overtimeRequests = state.overtimeRequests.map((item) => {
      if (item.employeeId !== employeeId || item.date !== todayKey() || item.status !== 'approved') return item;
      const approvedHours = item.approvedHours ?? item.requestedHours;
      const completedHours = Math.min(approvedHours, Math.max(0, actualOvertime - completedOvertime));
      completedOvertime += completedHours;
      return { ...item, completedHours, extraHours: Math.max(0, actualOvertime - completedOvertime) };
    });
    return { sessions, overtimeRequests };
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
  merge: (persistedState, currentState) => ({
    ...currentState,
    ...persistedState,
    attendanceAdjustments: persistedState?.attendanceAdjustments ?? [],
    salaryAdjustments: persistedState?.salaryAdjustments ?? [],
    remindersEnabled: persistedState?.remindersEnabled ?? true,
  }),
  partialize: (state) => ({
    companies: state.companies,
    employees: state.employees,
    sessions: state.sessions,
    overtimeRequests: state.overtimeRequests,
    attendanceAdjustments: state.attendanceAdjustments,
    salaryAdjustments: state.salaryAdjustments,
    payroll: state.payroll,
    reminderIds: state.reminderIds,
    remindersEnabled: state.remindersEnabled,
    activeCompanyId: state.activeCompanyId,
    theme: state.theme,
  }),
}));
