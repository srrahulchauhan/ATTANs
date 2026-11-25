import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Building2, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coffee, Download,
  FileText, LayoutDashboard, LogIn, LogOut, Moon, Plus, Search, Settings,
  Sun, Users, Wallet, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHrmsStore } from './store/hrmsStore.js';
import { exportCsv, exportPdf, exportXlsx } from './services/exportService.web.js';
import { formatDuration, sessionWorkMilliseconds, todayKey } from './utils/timeCalculator.js';

const currency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const attendanceStatuses = ['Present', 'Half Day', 'Absent', 'Paid Leave', 'Unpaid Leave', 'Weekly Off', 'Public Holiday'];
const navItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: Clock3 },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: Users },
];
const pagePaths = {
  dashboard: '/dashboard',
  attendance: '/attendance',
  accounts: '/accounts',
  reports: '/reports',
  profile: '/profile',
  employees: '/employees',
  companies: '/companies',
  settings: '/settings',
};
const pageByPath = Object.fromEntries(Object.entries(pagePaths).map(([page, path]) => [path, page]));
const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthDates(month) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function lastDayOfMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return localDateKey(new Date(year, month, 0));
}

function Avatar({ employee, size = 'normal' }) {
  const initials = (employee?.name ?? '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return employee?.photo
    ? <img className={`avatar ${size}`} src={employee.photo} alt="" />
    : <span className={`avatar initials ${size}`}>{initials}</span>;
}

function Card({ children, className = '', onClick, ariaLabel }) {
  function activate(event) {
    if (event.target.closest('button, a, input, select, textarea')) return;
    onClick?.(event);
  }
  return (
    <motion.section
      className={`card ${className} ${onClick ? 'card-clickable' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      onClick={onClick ? activate : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick(event);
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      whileTap={onClick ? { scale: 0.99 } : undefined}
    >
      {children}
    </motion.section>
  );
}

function Button({ children, variant = 'primary', ...props }) {
  return <motion.button className={`button ${variant}`} whileTap={{ scale: 0.97 }} {...props}>{children}</motion.button>;
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.99 }} transition={{ duration: 0.18 }}>
        <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
        {children}
      </motion.section>
    </div>
  );
}

function PageTitle({ eyebrow, title, action }) {
  return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</div>;
}

function Metric({ label, value, note, icon: Icon, tone = 'indigo', onClick }) {
  const content = <><span className={`metric-icon ${tone}`}><Icon size={19} /></span><span className="metric-content"><span className="muted">{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</span></>;
  return onClick
    ? <button className="metric-card metric-clickable" onClick={onClick}>{content}</button>
    : <div className="metric-card">{content}</div>;
}

function App() {
  const state = useHrmsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageByPath[location.pathname] ?? 'dashboard';
  const go = (nextPage) => navigate(pagePaths[nextPage] ?? pagePaths.dashboard);
  const [hydrated, setHydrated] = useState(() => useHrmsStore.persist.hasHydrated());
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');

  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const companyEmployees = state.employees.filter((item) => item.companyId === state.activeCompanyId);
  const activeEmployees = companyEmployees.filter((item) => item.status === 'active');
  const selectedEmployee = activeEmployees.find((item) => item.id === selectedEmployeeId) ?? activeEmployees[0];
  const session = selectedEmployee ? state.activeSessionFor(selectedEmployee.id) : undefined;
  const todaySession = selectedEmployee && state.sessions.find((item) => item.employeeId === selectedEmployee.id && item.date === todayKey());
  const todayCorrection = selectedEmployee && state.attendanceAdjustments.find((item) => item.employeeId === selectedEmployee.id && item.date === todayKey());
  const workMs = sessionWorkMilliseconds(session ?? todaySession, now);
  const workHours = workMs / 3600000;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    if (!pageByPath[location.pathname]) navigate(pagePaths.dashboard, { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    const finishHydration = () => setHydrated(true);
    const unsubscribe = useHrmsStore.persist.onFinishHydration(finishHydration);
    if (useHrmsStore.persist.hasHydrated()) finishHydration();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!state.remindersEnabled || !selectedEmployee) return;
    const time = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (!state.reminderTimes.includes(time)) return;
    const alreadyMarked = state.attendanceAdjustments.some((item) => item.employeeId === selectedEmployee.id && item.date === todayKey())
      || state.sessions.some((item) => item.employeeId === selectedEmployee.id && item.date === todayKey());
    const reminderId = `${selectedEmployee.id}-${todayKey()}-${time}`;
    if (alreadyMarked || state.reminderIds.includes(reminderId)) return;
    state.setReminderIds([...state.reminderIds, reminderId]);
    setToast(`Attendance reminder: mark today for ${selectedEmployee.name}.`);
  }, [now, selectedEmployee?.id, state]);

  const todaySessions = state.sessions.filter((item) => item.companyId === state.activeCompanyId && item.date === todayKey());
  const filteredEmployees = companyEmployees.filter((employee) => {
    const text = `${employee.name} ${employee.code} ${employee.designation} ${employee.department}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (department === 'All' || employee.department === department);
  });

  function openEmployee(employee) {
    setModal({ type: 'employee', employee });
  }

  function saveEmployee(values) {
    const existing = values.id ? state.employees.find((item) => item.id === values.id) : null;
    const monthlySalary = Number(values.monthlySalary) || 0;
    const workingDaysPerMonth = Math.min(31, Math.max(1, Number(values.workingDaysPerMonth) || 26));
    const basisChanged = existing && (
      Number(existing.salary.monthlySalary) !== monthlySalary
      || Number(existing.salary.workingDaysPerMonth) !== workingDaysPerMonth
    );
    const formulaRate = monthlySalary / workingDaysPerMonth;
    const enteredRate = Number(values.perDaySalary);
    const perDaySalary = basisChanged || !Number.isFinite(enteredRate) ? formulaRate : enteredRate;
    const enteredHalfDay = Number(values.halfDaySalary);
    const enteredPaidLeave = Number(values.paidLeaveSalary);
    const enteredUnpaidDeduction = Number(values.unpaidLeaveDeduction);
    const employee = {
      ...(existing ?? {}),
      id: existing?.id ?? `e-${Date.now()}`,
      companyId: existing?.companyId ?? state.activeCompanyId,
      name: values.name.trim(),
      code: values.code.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      designation: values.designation.trim(),
      department: values.department.trim(),
      joiningDate: existing?.joiningDate ?? todayKey(),
      status: existing?.status ?? 'active',
      shiftStart: values.shiftStart || '09:00',
      shiftEnd: values.shiftEnd || '17:00',
      requiredHours: Number(values.requiredHours) || 8,
      weeklyOffs: existing?.weeklyOffs ?? [0],
      role: existing?.role ?? 'employee',
      salary: {
        ...(existing?.salary ?? {}),
        monthlySalary,
        calculationType: 'monthly',
        workingDaysPerMonth,
        perDaySalary,
        perDaySalaryOverride: !basisChanged && Math.abs(perDaySalary - formulaRate) > 0.005,
        halfDaySalary: values.halfDaySalary !== '' && Number.isFinite(enteredHalfDay) ? enteredHalfDay : perDaySalary / 2,
        perHourSalary: perDaySalary / 8,
        overtimeRate: Number(values.overtimeRate) || 0,
        paidLeaveSalary: values.paidLeaveSalary !== '' && Number.isFinite(enteredPaidLeave) ? enteredPaidLeave : perDaySalary,
        unpaidLeaveDeduction: values.unpaidLeaveDeduction !== '' && Number.isFinite(enteredUnpaidDeduction) ? enteredUnpaidDeduction : perDaySalary,
        allowances: Number(values.allowances) || 0,
        deductions: Number(values.deductions) || 0,
        fullDayHours: Number(values.fullDayHours) || 8,
        halfDayHours: Number(values.halfDayHours) || 4,
      },
    };
    if (existing) state.updateEmployee(employee);
    else state.addEmployee(employee);
    setModal(null);
  }

  function removeEmployee(employee) {
    if (window.confirm(`Delete ${employee.name} and related local records?`)) state.deleteEmployee(employee.id);
  }

  function saveCompany(values) {
    const existing = values.id ? state.companies.find((item) => item.id === values.id) : null;
    const item = {
      ...(existing ?? {}),
      id: existing?.id ?? `c-${Date.now()}`,
      name: values.name.trim(),
      address: values.address.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      registration: values.registration.trim(),
      color: values.color || colors[0],
      holidays: existing?.holidays ?? [],
      salaryPolicy: {
        payWeeklyOff: values.payWeeklyOff ?? existing?.salaryPolicy?.payWeeklyOff ?? true,
        payPublicHoliday: values.payPublicHoliday ?? existing?.salaryPolicy?.payPublicHoliday ?? true,
      },
    };
    if (existing) state.updateCompany(item);
    else state.addCompany(item);
    setModal(null);
  }

  async function exportAttendance() {
    const companyEmployeesById = new Map(state.employees.filter((item) => item.companyId === state.activeCompanyId).map((item) => [item.id, item]));
    const corrections = state.attendanceAdjustments.filter((item) => companyEmployeesById.has(item.employeeId));
    const correctedDays = new Set(corrections.map((item) => `${item.employeeId}:${item.date}`));
    const rows = [
      ['Employee', 'Employee ID', 'Date', 'Status', 'Clock in', 'Clock out', 'Working hours', 'Overtime hours', 'Salary earned', 'Overtime earnings', 'Remarks'],
      ...corrections.map((item) => {
        const employee = companyEmployeesById.get(item.employeeId);
        const salary = state.salaryTransactions.find((transaction) => transaction.id === `attendance-${item.employeeId}-${item.date}`);
        const overtime = state.salaryTransactions.find((transaction) => transaction.id === `overtime-${item.employeeId}-${item.date}`);
        const session = state.sessions.find((record) => record.employeeId === item.employeeId && record.date === item.date);
        return [employee?.name ?? '', employee?.code ?? '', item.date, item.status, session?.clockInAt ? new Date(session.clockInAt).toLocaleTimeString() : '', session?.clockOutAt ? new Date(session.clockOutAt).toLocaleTimeString() : '', session ? (session.workMs / 3600000).toFixed(2) : '', item.overtimeHours ?? 0, Number(salary?.amount ?? item.salaryEarnings ?? 0).toFixed(2), Number(overtime?.amount ?? item.overtimeEarnings ?? 0).toFixed(2), item.note ?? ''];
      }),
      ...state.sessions.filter((item) => item.companyId === state.activeCompanyId && !correctedDays.has(`${item.employeeId}:${item.date}`)).map((item) => {
        const employee = companyEmployeesById.get(item.employeeId);
        const salary = state.salaryTransactions.find((transaction) => transaction.id === `attendance-${item.employeeId}-${item.date}`);
        const overtime = state.salaryTransactions.find((transaction) => transaction.id === `overtime-${item.employeeId}-${item.date}`);
        return [employee?.name ?? '', employee?.code ?? '', item.date, item.status, new Date(item.clockInAt).toLocaleTimeString(), item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '', (item.workMs / 3600000).toFixed(2), overtime?.hours ?? 0, Number(salary?.amount ?? 0).toFixed(2), Number(overtime?.amount ?? 0).toFixed(2), ''];
      }),
    ];
    try {
      await exportCsv(`attan-attendance-${state.activeCompanyId}-${todayKey()}`, rows);
      setToast('Attendance CSV downloaded.');
    } catch (error) {
      window.console.error('Unable to export attendance.', error);
      setToast(error instanceof Error ? `Export failed: ${error.message}` : 'Attendance export failed.');
    }
  }

  const titleMap = {
    dashboard: ['YOUR WORKSPACE', 'Overview'],
    attendance: ['TIME & ATTENDANCE', 'Attendance'],
    accounts: ['PAYROLL OVERVIEW', 'Accounts'],
    reports: ['INSIGHTS & EXPORTS', 'Reports'],
    profile: ['YOUR ACCOUNT', 'Profile'],
    employees: ['YOUR TEAM', 'Employees'],
    settings: ['ACCOUNT & SETTINGS', 'Settings'],
    companies: ['WORKSPACE', 'Companies'],
  };
  const [eyebrow, title] = titleMap[page] ?? titleMap.dashboard;

  if (!hydrated) return <AppSkeleton />;

  return (
    <div className="app-shell min-h-screen antialiased">
      <aside className="sidebar">
        <div className="brand"><img className="brand-mark-image" src="/assets/attan-app-icon.svg" alt="" /><span>attan<small>PEOPLE OPERATIONS</small></span></div>
        <div className="workspace-picker">
          <span className="workspace-dot" style={{ backgroundColor: company?.color ?? colors[0] }} />
          <select aria-label="Active company" value={state.activeCompanyId} onChange={(event) => state.setActiveCompany(event.target.value)}>
            {state.companies.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'selected' : ''}`} onClick={() => go(id)}><Icon size={18} /><span>{label}</span></button>)}
          <p className="nav-caption nav-caption-spaced">MANAGE</p>
          <button className={`nav-link ${page === 'employees' ? 'selected' : ''}`} onClick={() => go('employees')}><Users size={18} /><span>Employees</span></button>
          <button className={`nav-link ${page === 'companies' ? 'selected' : ''}`} onClick={() => go('companies')}><Building2 size={18} /><span>Companies</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="status-dot" />Local workspace is ready</div>
          <button className="profile-link" onClick={() => go('profile')}><span className="profile-badge">{selectedEmployee?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? 'AS'}</span><span><strong>{selectedEmployee?.name ?? 'Workspace Admin'}</strong><small>{company?.name ?? 'Your company'}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-brand"><img className="brand-mark-image" src="/assets/attan-app-icon.svg" alt="" /><span>attan</span></div>
          <div className="crumb">Workspace <span>/</span> {title}</div>
          <div className="topbar-actions"><span className="date-pill"><CalendarDays size={15} />{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><button className="theme-toggle" onClick={() => state.setTheme(state.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div>
        </header>
        <div className="content">
          {page !== 'attendance' && <PageTitle eyebrow={eyebrow} title={title} action={
            page === 'employees' ? <Button onClick={() => openEmployee(null)}><Plus size={16} /> Add employee</Button>
              : page === 'companies' ? <Button onClick={() => setModal({ type: 'company', company: null })}><Plus size={16} /> Add company</Button>
                : null
          } />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={page} className="page-transition" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
              {page === 'dashboard' && <DashboardPage state={state} company={company} activeEmployees={activeEmployees} todaySessions={todaySessions} employee={selectedEmployee} now={now} go={go} markAttendance={() => setModal({ type: 'quick-attendance' })} />}
              {page === 'employees' && <EmployeesPage employees={filteredEmployees} allEmployees={companyEmployees} query={query} setQuery={setQuery} department={department} setDepartment={setDepartment} edit={openEmployee} remove={removeEmployee} />}
              {page === 'attendance' && <AttendancePage state={state} employees={activeEmployees} selected={selectedEmployee} selectEmployee={setSelectedEmployeeId} session={session} todaySession={todaySession} correction={todayCorrection} workMs={workMs} workHours={workHours} now={now} notify={setToast} />}
              {page === 'accounts' && <AccountsPage state={state} employees={activeEmployees} company={company} notify={setToast} />}
              {page === 'reports' && <ReportsPage state={state} employees={activeEmployees} company={company} exportAttendance={exportAttendance} notify={setToast} />}
              {page === 'profile' && <ProfilePage employee={selectedEmployee} company={company} state={state} go={go} exportAttendance={exportAttendance} />}
              {page === 'companies' && <CompaniesPage state={state} setModal={setModal} go={go} />}
              {page === 'settings' && <SettingsPage state={state} company={company} exportAttendance={exportAttendance} setPage={go} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <MobileNav page={page} go={go} />
      </main>
      {modal?.type === 'employee' && <EmployeeModal employee={modal.employee} onClose={() => setModal(null)} onSave={saveEmployee} onDelete={removeEmployee} />}
      {modal?.type === 'company' && <CompanyModal company={modal.company} onClose={() => setModal(null)} onSave={saveCompany} />}
      {modal?.type === 'quick-attendance' && <QuickAttendanceModal employees={activeEmployees} attendance={state.attendanceAdjustments} onClose={() => setModal(null)} onSave={async (entry) => {
        try {
          await state.markAttendance(entry.employeeId, entry.date, entry.status, entry.note, entry.overtimeHours);
          setModal(null);
          setToast('Attendance saved for today.');
        } catch (error) {
          window.console.error('Unable to save attendance.', error);
          setToast(error instanceof Error ? error.message : 'Unable to save attendance.');
        }
      }} />}
      <AnimatePresence>{toast && <motion.div className="toast-message" role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><span><Check size={16} /></span>{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

function AppSkeleton() {
  return <main className="app-skeleton" aria-label="Loading workspace">
    <div className="skeleton skeleton-header" />
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-hero" />
    <div className="skeleton-grid"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
  </main>;
}

function MobileNav({ page, go }) {
  return <nav className="mobile-nav" aria-label="Primary navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'selected' : ''} onClick={() => go(id)}><motion.span className="mobile-nav-icon" animate={{ y: page === id ? -2 : 0, scale: page === id ? 1.05 : 1 }}><Icon size={19} /></motion.span><span>{label}</span></button>)}</nav>;
}

function DashboardPage({ state, company, activeEmployees, todaySessions, employee, now, go, markAttendance }) {
  const working = todaySessions.filter((item) => item.status === 'working').length;
  const breaks = todaySessions.filter((item) => item.status === 'break').length;
  const marked = new Set([...todaySessions.map((item) => item.employeeId), ...state.attendanceAdjustments.filter((item) => item.date === todayKey()).map((item) => item.employeeId)]).size;
  const activity = [...todaySessions].reverse().slice(0, 5);
  const month = todayKey().slice(0, 7);
  const attendance = activeEmployees.map((item) => getEmployeeMonthSummary(state, item, month));
  const present = attendance.reduce((sum, item) => sum + item.presentDays, 0);
  const absent = attendance.reduce((sum, item) => sum + item.absentDays, 0);
  const halfDays = attendance.reduce((sum, item) => sum + item.halfDays, 0);
  const holidays = attendance.reduce((sum, item) => sum + item.holidayDays, 0);
  const payroll = employee ? getEmployeeMonthSummary(state, employee, month) : null;
  const employeeLedger = state.salaryTransactions.filter((item) => item.employeeId === employee?.id);
  const accountBalance = employeeLedger.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const latestPayment = state.salaryPayments.filter((item) => item.employeeId === employee?.id).sort((a, b) => b.paidAt - a.paidAt)[0];
  const employeeTodayCorrection = state.attendanceAdjustments.find((item) => item.employeeId === employee?.id && item.date === todayKey());
  const employeeTodaySession = state.sessions.find((item) => item.employeeId === employee?.id && item.date === todayKey());
  const todayStatus = employeeTodayCorrection?.status ?? (employeeTodaySession ? employeeTodaySession.status === 'clocked-out' ? 'Present' : employeeTodaySession.status : 'Not marked');
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  return <>
    <div className="dashboard-hero">
      <div className="dashboard-hero-copy"><span className="hero-kicker"><span className="live-pulse" />YOUR PEOPLE, AT A GLANCE</span><h2>{greeting}{employee ? `, ${employee.name.split(' ')[0]}` : ''}</h2><p>Your team&apos;s day is taking shape. Here&apos;s the latest from {company?.name ?? 'your workspace'}.</p><div className="hero-footer"><span><CalendarDays size={15} />{new Date(now).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</span><span className="live-clock">{new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><button className="hero-action" onClick={markAttendance}><Plus size={16} /> Mark attendance</button></div></div>
      <div className="hero-profile">{employee ? <Avatar employee={employee} size="large" /> : <span className="avatar initials large">A</span>}<div><strong>{employee?.name ?? 'Workspace admin'}</strong><span>{employee?.code ?? employee?.designation ?? 'Administrator'}</span><small>{employee?.designation ?? employee?.department ?? company?.name}</small><small>{employee?.joiningDate ? `Joined ${new Date(`${employee.joiningDate}T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''} · {employee?.shiftStart ?? ''}–{employee?.shiftEnd ?? ''}</small></div><button className="hero-profile-link" onClick={() => go('profile')} aria-label="Open profile"><ArrowRight size={17} /></button></div>
    </div>
    <div className="section-lead"><div><span className="eyebrow">THIS MONTH</span><h2>Attendance overview</h2></div><button className="text-button" onClick={() => go('attendance')}>Open calendar <ArrowRight size={15} /></button></div>
    <div className="metric-grid dashboard-metrics">
      <Metric label="Present days" value={present} note={`${marked} team members checked in today`} icon={Check} tone="green" onClick={() => go('attendance')} />
      <Metric label="Absent days" value={absent} note="Across active employees" icon={X} tone="rose" onClick={() => go('attendance')} />
      <Metric label="Half days" value={halfDays} note="Attendance adjustments" icon={Clock3} tone="amber" onClick={() => go('attendance')} />
      <Metric label="Total holidays" value={holidays} note="Weekly offs & public holidays" icon={CalendarDays} tone="blue" onClick={() => go('attendance')} />
    </div>
    <div className="dashboard-detail-grid">
      <button onClick={() => go('attendance')}><span>Today&apos;s status</span><strong>{todayStatus}</strong><small>{employee?.shiftStart}–{employee?.shiftEnd} shift</small></button>
      <button onClick={() => go('attendance')}><span>Overtime this month</span><strong>{payroll?.overtimeHours ?? 0} hrs</strong><small>{currency(payroll?.overtimeEarnings)} earned</small></button>
      <button onClick={() => go('accounts')}><span>Contribution balance</span><strong>{currency(accountBalance)}</strong><small>Salary and overtime ledger</small></button>
      <button onClick={() => go('accounts')}><span>Pending salary</span><strong>{currency(Math.max(0, Number(employee?.salary.monthlySalary ?? 0) - (payroll?.netSalary ?? 0)))}</strong><small>{latestPayment ? `Last paid ${new Date(latestPayment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'No salary payment recorded'}</small></button>
    </div>
    <div className="finance-strip">
      <button className="finance-highlight" onClick={() => go('accounts')}><span className="finance-icon"><Wallet size={19} /></span><span className="finance-label">Monthly salary</span><strong>{currency(employee?.salary.monthlySalary)}</strong><small>{employee?.name ?? 'Selected employee'} · configured pay</small><ArrowUpRight className="finance-arrow" size={18} /></button>
      <button className="finance-tile" onClick={() => go('accounts')}><span className="finance-label">Daily contribution</span><strong>{currency(employee?.salary.perDaySalary)}</strong><small><ArrowDownRight size={13} /> Per working day</small></button>
      <button className="finance-tile" onClick={() => go('accounts')}><span className="finance-label">Earned this month</span><strong>{currency(payroll?.netSalary)}</strong><small>Based on recorded attendance</small></button>
    </div>
    <div className="dashboard-grid">
      <Card onClick={() => go('attendance')} ariaLabel="Open today's attendance tracker"><div className="section-heading"><div><h2>Today&apos;s attendance</h2><p>Real-time overview for {company?.name}</p></div><div className="attendance-dashboard-actions"><button className="text-button" onClick={markAttendance}><Check size={15} /> Mark attendance</button><button className="text-button" onClick={() => go('attendance')}>Open tracker <ArrowRight size={15} /></button></div></div>
        <div className="attendance-progress"><div className="progress-ring" style={{ '--progress': `${activeEmployees.length ? Math.round(marked / activeEmployees.length * 100) : 0}%` }}><strong>{activeEmployees.length ? Math.round(marked / activeEmployees.length * 100) : 0}%</strong></div><div><h3>{marked} of {activeEmployees.length} employees</h3><p>have an attendance record today</p><div className="legend"><span><i className="green-dot" />Working {working}</span><span><i className="amber-dot" />On break {breaks}</span></div></div></div>
      </Card>
    </div>
    <Card className="activity-card" onClick={() => go('attendance')} ariaLabel="Open recent attendance details"><div className="section-heading"><div><h2>Recent attendance activity</h2><p>Latest team updates for today</p></div><button className="text-button" onClick={() => go('attendance')}>View all <ArrowRight size={15} /></button></div>
      {activity.length ? <div className="activity-list">{activity.map((item) => {
        const employee = state.employees.find((person) => person.id === item.employeeId);
        return <div className="activity-item" key={item.id}><Avatar employee={employee} /><div className="activity-name"><strong>{employee?.name ?? 'Employee'}</strong><span>{employee?.designation ?? 'Team member'} · {new Date(item.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><span className={`status-tag ${item.status}`}>{item.status === 'clocked-out' ? 'Completed' : item.status}</span></div>;
      })}</div> : <div className="empty-state"><Clock3 size={24} /><strong>No attendance activity yet</strong><p>Team clock-ins will appear here.</p></div>}
    </Card>
    <div className="section-lead"><div><span className="eyebrow">QUICK ACTIONS</span><h2>Shortcuts</h2></div></div>
    <div className="quick-actions">
      {[
        ['Mark Attendance', 'Record or update a shift', Check, markAttendance],
        ['Live Tracker', 'Clock in, break and clock out', Clock3, () => go('attendance')],
        ['Attendance Calendar', 'Review or edit past days', CalendarDays, () => go('attendance')],
        ['Salary Account', 'Balance and contributions', Wallet, () => go('accounts')],
        ['Reports', 'Attendance and payroll exports', BarChart3, () => go('reports')],
        ['Overtime', 'Review requests and hours', Coffee, () => go('attendance')],
        ['Salary History', 'Transactions and payments', FileText, () => go('accounts')],
        ['Settings', 'Preferences and workspace', Settings, () => go('settings')],
      ].map(([label, hint, Icon, action]) => <button key={label} onClick={action}><Icon size={17} /><span><strong>{label}</strong><small>{hint}</small></span><ArrowRight size={16} /></button>)}
    </div>
  </>;
}

function getEmployeeMonthSummary(state, employee, month) {
  const salary = employee.salary ?? {};
  const dailyRate = Number(salary.perDaySalary ?? 0);
  const ledger = state.salaryTransactions.filter((item) => item.employeeId === employee.id && item.attendanceDate.startsWith(month));
  const ledgerByDate = new Map(ledger.map((item) => [`${item.type}:${item.attendanceDate}`, item]));
  const records = new Map();
  state.sessions.filter((item) => item.employeeId === employee.id && item.date.startsWith(month)).forEach((item) => records.set(item.date, { session: item }));
  state.attendanceAdjustments.filter((item) => item.employeeId === employee.id && item.date.startsWith(month)).forEach((item) => {
    records.set(item.date, { ...records.get(item.date), adjustment: item });
  });

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let holidayDays = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let grossSalary = 0;
  let overtimeEarnings = ledger.filter((item) => item.type === 'overtime-credit').reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  let overtimeHours = ledger.filter((item) => item.type === 'overtime-credit').reduce((sum, item) => sum + Number(item.hours ?? 0), 0);
  const transactions = [];
  records.forEach((record, date) => {
    let paidFraction = 0;
    let status = record.adjustment?.status;
    if (status === 'Present') {
      paidFraction = 1;
      presentDays += 1;
    } else if (status === 'Half Day') {
      paidFraction = 0.5;
      halfDays += 1;
    } else if (status === 'Paid Leave') {
      paidFraction = 1;
      paidLeaves += 1;
    } else if (status === 'Weekly Off' || status === 'Public Holiday') {
      paidFraction = 1;
      holidayDays += 1;
    } else if (status === 'Absent' || status === 'Unpaid Leave') {
      absentDays += 1;
      if (status === 'Unpaid Leave') unpaidLeaves += 1;
    } else if (record.session) {
      const workedMs = sessionWorkMilliseconds(record.session);
      paidFraction = Math.min(1, workedMs / (Math.max(1, employee.requiredHours) * 3600000));
      if (paidFraction > 0) {
        if (paidFraction < 1) halfDays += paidFraction;
        else presentDays += 1;
      }
    }
    const savedSalaryCredit = ledgerByDate.get(`attendance-credit:${date}`);
    const savedOvertimeCredit = ledgerByDate.get(`overtime-credit:${date}`);
    const contribution = savedSalaryCredit
      ? Number(savedSalaryCredit.amount)
      : Number(record.adjustment?.salaryEarnings ?? dailyRate * paidFraction);
    if (record.adjustment && !savedOvertimeCredit) {
      overtimeEarnings += Number(record.adjustment.overtimeEarnings ?? 0);
      overtimeHours += Number(record.adjustment.overtimeHours ?? 0);
    }
    grossSalary += contribution;
    transactions.push({ date, status: status ?? (record.session ? 'Shift recorded' : 'Attendance updated'), contribution });
  });

  const adjustedDates = new Set(state.attendanceAdjustments.filter((item) => item.employeeId === employee.id && item.date.startsWith(month)).map((item) => item.date));
  state.overtimeRequests
    .filter((item) => item.employeeId === employee.id && item.date.startsWith(month) && item.status === 'approved' && !adjustedDates.has(item.date))
    .forEach((item) => {
      const completedHours = Number(item.completedHours ?? 0);
      overtimeHours += completedHours;
      overtimeEarnings += completedHours * Number(salary.overtimeRate ?? 0);
    });
  const workingDays = Math.max(1, Number(salary.workingDaysPerMonth ?? 26));
  const paidRatio = Math.min(1, (presentDays + halfDays / 2 + paidLeaves + holidayDays) / workingDays);
  const allowances = Number(salary.allowances ?? 0) * paidRatio;
  const deductions = Number(salary.deductions ?? 0) * paidRatio;
  return {
    presentDays,
    absentDays,
    halfDays,
    holidayDays,
    paidLeaves,
    unpaidLeaves,
    grossSalary,
    overtimeHours,
    overtimeEarnings,
    allowances,
    deductions,
    netSalary: Math.max(0, grossSalary + overtimeEarnings + allowances - deductions),
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

function AccountsPage({ state, employees, company, notify }) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const month = todayKey().slice(0, 7);
  const summaries = employees.map((employee) => ({ employee, ...getEmployeeMonthSummary(state, employee, month) }));
  const gross = summaries.reduce((sum, item) => sum + item.grossSalary, 0);
  const overtime = summaries.reduce((sum, item) => sum + item.overtimeEarnings, 0);
  const deductions = summaries.reduce((sum, item) => sum + item.deductions, 0);
  const net = summaries.reduce((sum, item) => sum + item.netSalary, 0);
  const plannedPayroll = employees.reduce((sum, item) => sum + Number(item.salary.monthlySalary ?? 0), 0);
  const dailyContribution = employees.reduce((sum, item) => sum + Number(item.salary.perDaySalary ?? 0), 0);
  const employeeIds = new Set(employees.map((item) => item.id));
  const transactions = state.salaryTransactions.filter((item) => employeeIds.has(item.employeeId))
    .map((transaction) => ({ ...transaction, employee: state.employees.find((item) => item.id === transaction.employeeId) }))
    .sort((a, b) => b.transactionDate - a.transactionDate).slice(0, 8);
  const accountBalance = state.salaryTransactions.filter((item) => employeeIds.has(item.employeeId)).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const paymentHistory = state.salaryPayments.filter((item) => employeeIds.has(item.employeeId)).sort((a, b) => b.paidAt - a.paidAt);
  const latestPayment = paymentHistory[0];
  return <>
    <div className="screen-intro"><div><p className="eyebrow">{new Date(`${month}-15T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} PAYROLL</p><h2>Accounts at a glance</h2><p>Salary estimates are based on recorded attendance and configured pay rates.</p></div><span className="report-chip"><Wallet size={15} />{company?.name}</span></div>
    <div className="accounts-hero"><div><span className="hero-kicker">CONTRIBUTION ACCOUNT BALANCE</span><strong>{currency(accountBalance)}</strong><p>Net saved salary and overtime credits across active team members</p></div><div className="accounts-hero-side"><span>Monthly payroll plan</span><strong>{currency(plannedPayroll)}</strong><small>Across {employees.length} active employees</small></div></div>
    <div className="metric-grid account-metrics">
      <Metric label="Earned to date" value={currency(gross)} note="Attendance-based salary" icon={ArrowUpRight} tone="green" />
      <Metric label="Daily contribution" value={currency(dailyContribution)} note="Team per-day salary total" icon={CalendarDays} tone="blue" />
      <Metric label="Overtime earnings" value={currency(overtime)} note="Approved and completed" icon={Clock3} tone="amber" />
      <Metric label="Deductions" value={currency(deductions)} note="Pro-rated configured deductions" icon={ArrowDownRight} tone="rose" />
    </div>
    <div className="account-toolbar"><span><strong>Pending salary</strong><small>{currency(Math.max(0, plannedPayroll - net))} estimated after recorded earnings</small></span><span><strong>Last salary payment</strong><small>{latestPayment ? `${currency(latestPayment.amount)} · ${new Date(latestPayment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'No payments recorded yet'}</small></span><Button disabled={accountBalance <= 0 || !employees.length} onClick={() => setPaymentOpen(true)}><Wallet size={15} /> Record payment</Button></div>
    <div className="accounts-layout">
      <Card className="breakdown-card"><div className="section-heading"><div><h2>Salary breakdown</h2><p>Month-to-date by employee</p></div><span className="report-chip">{month}</span></div>
        {summaries.length ? <div className="salary-breakdown-list">{summaries.map((item) => <div className="salary-breakdown-row" key={item.employee.id}><Avatar employee={item.employee} /><div className="breakdown-person"><strong>{item.employee.name}</strong><span>{item.presentDays + item.halfDays / 2} paid days · {item.employee.designation}</span><div className="breakdown-bar"><i style={{ width: `${Math.min(100, item.employee.salary.monthlySalary ? item.netSalary / item.employee.salary.monthlySalary * 100 : 0)}%` }} /></div></div><strong>{currency(item.netSalary)}</strong></div>)}</div> : <div className="empty-state"><Users size={24} /><strong>No active employees</strong><p>Add an employee to prepare salary information.</p></div>}
        <div className="breakdown-totals"><span>Gross earned <strong>{currency(gross)}</strong></span><span>Overtime <strong>{currency(overtime)}</strong></span><span>Deductions <strong>−{currency(deductions)}</strong></span><span className="net-total">Estimated net <strong>{currency(net)}</strong></span></div>
      </Card>
      <Card className="transaction-card"><div className="section-heading"><div><h2>Recent transactions</h2><p>Recorded attendance contributions</p></div><span className="report-chip">{transactions.length} entries</span></div>
        {transactions.length ? <div className="transaction-list">{transactions.map((item) => <div className="transaction-row" key={item.id}><span className="transaction-icon">{item.type === 'overtime-credit' ? <Clock3 size={16} /> : item.type === 'salary-payment' ? <Wallet size={16} /> : <CalendarDays size={16} />}</span><span><strong>{item.employee?.name ?? 'Employee'}</strong><small>{item.description} · {new Date(item.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span><strong className={item.amount < 0 ? 'debit-amount' : 'credit-amount'}>{item.amount < 0 ? '−' : '+'}{currency(Math.abs(item.amount))}</strong></div>)}</div> : <div className="empty-state"><Wallet size={24} /><strong>No salary activity yet</strong><p>Attendance-based salary activity will show here.</p></div>}
      </Card>
    </div>
    {paymentOpen && <PaymentModal employees={employees} maxAmount={accountBalance} onClose={() => setPaymentOpen(false)} onSave={async (entry) => {
      try {
        await state.recordSalaryPayment(entry.employeeId, entry.amount, entry.note);
        setPaymentOpen(false);
        notify('Salary payment recorded.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Unable to record salary payment.');
      }
    }} />}
  </>;
}

function PaymentModal({ employees, maxAmount, onClose, onSave }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const employeeBalance = Math.min(maxAmount, useHrmsStore.getState().salaryTransactions
    .filter((item) => item.employeeId === employeeId)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0));
  const [amount, setAmount] = useState(String(employeeBalance));
  const [note, setNote] = useState('');
  return <Modal title="Record salary payment" onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => {
      event.preventDefault();
      const paymentAmount = Number(amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > employeeBalance) return window.alert(`Enter a payment between ₹1 and ${currency(employeeBalance)}.`);
      onSave({ employeeId, amount: paymentAmount, note: note.trim() });
    }}>
      <label className="field"><span>Employee</span><select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setAmount(''); }}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}</select></label>
      <Field label={`Amount (available ${currency(employeeBalance)})`} type="number" min="1" max={employeeBalance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      <Field label="Payment note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reference or payment method" />
      <footer className="modal-actions"><span /><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!employeeBalance}><Check size={15} /> Confirm payment</Button></footer>
    </form>
  </Modal>;
}

function ReportsPage({ state, employees, company, exportAttendance, notify }) {
  const [reportType, setReportType] = useState('Monthly');
  const [reportMonth, setReportMonth] = useState(todayKey().slice(0, 7));
  const [employeeId, setEmployeeId] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState(`${todayKey().slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(todayKey());
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const adjustmentKeys = new Set(state.attendanceAdjustments.map((item) => `${item.employeeId}:${item.date}`));
  const attendanceRows = [
    ...state.attendanceAdjustments
      .filter((item) => employeeMap.has(item.employeeId))
      .map((item) => {
        const employee = employeeMap.get(item.employeeId);
        const salaryCredit = state.salaryTransactions.find((transaction) => transaction.id === `attendance-${item.employeeId}-${item.date}`);
        const overtimeCredit = state.salaryTransactions.find((transaction) => transaction.id === `overtime-${item.employeeId}-${item.date}`);
        return {
          employee,
          date: item.date,
          status: item.status,
          note: item.note ?? '',
          overtimeHours: Number(item.overtimeHours ?? overtimeCredit?.hours ?? 0),
          salaryEarnings: Number(salaryCredit?.amount ?? item.salaryEarnings ?? 0),
          overtimeEarnings: Number(overtimeCredit?.amount ?? item.overtimeEarnings ?? 0),
        };
      }),
    ...state.sessions
      .filter((session) => employeeMap.has(session.employeeId) && !adjustmentKeys.has(`${session.employeeId}:${session.date}`))
      .map((session) => {
        const employee = employeeMap.get(session.employeeId);
        const workHours = Number(session.workMs ?? 0) / 3600000;
        const status = workHours >= Number(employee.salary?.fullDayHours ?? employee.requiredHours ?? 8)
          ? 'Present'
          : workHours >= Number(employee.salary?.halfDayHours ?? 4) ? 'Half Day' : 'Absent';
        const overtimeCredit = state.salaryTransactions.find((transaction) => transaction.id === `overtime-${session.employeeId}-${session.date}`);
        const salaryCredit = state.salaryTransactions.find((transaction) => transaction.id === `attendance-${session.employeeId}-${session.date}`);
        return {
          employee,
          date: session.date,
          status,
          note: 'Clock session',
          overtimeHours: Number(overtimeCredit?.hours ?? 0),
          salaryEarnings: Number(salaryCredit?.amount ?? (status === 'Present' ? employee.salary.perDaySalary : status === 'Half Day' ? employee.salary.halfDaySalary : 0)),
          overtimeEarnings: Number(overtimeCredit?.amount ?? 0),
        };
      }),
  ];
  const filteredRows = attendanceRows.filter((item) => {
    if (item.date < startDate || item.date > endDate) return false;
    if (employeeId !== 'All' && item.employee.id !== employeeId) return false;
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (reportType === 'Overtime' && item.overtimeHours <= 0) return false;
    if (reportType === 'Salary' && item.salaryEarnings + item.overtimeEarnings <= 0) return false;
    if (reportType === 'Holiday' && !['Weekly Off', 'Public Holiday'].includes(item.status)) return false;
    if (reportType === 'Absent' && item.status !== 'Absent') return false;
    if (reportType === 'Half Day' && item.status !== 'Half Day') return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
  const presentDays = filteredRows.filter((item) => item.status === 'Present').length;
  const absentDays = filteredRows.filter((item) => item.status === 'Absent').length;
  const halfDays = filteredRows.filter((item) => item.status === 'Half Day').length;
  const holidays = filteredRows.filter((item) => ['Weekly Off', 'Public Holiday'].includes(item.status)).length;
  const overtimeHours = filteredRows.reduce((sum, item) => sum + item.overtimeHours, 0);
  const totalEarned = filteredRows.reduce((sum, item) => sum + item.salaryEarnings + item.overtimeEarnings, 0);
  const filteredEmployeeIds = new Set(filteredRows.map((item) => item.employee.id));
  const totalPaid = state.salaryPayments.filter((item) => filteredEmployeeIds.has(item.employeeId) && item.paidAt >= new Date(`${startDate}T00:00:00`).getTime() && item.paidAt <= new Date(`${endDate}T23:59:59`).getTime())
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const remainingBalance = state.salaryTransactions.filter((item) => employeeId === 'All' ? employees.some((person) => person.id === item.employeeId) : item.employeeId === employeeId)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  function chooseReportType(type) {
    setReportType(type);
    const today = new Date();
    if (type === 'Daily') {
      setStartDate(todayKey());
      setEndDate(todayKey());
    } else if (type === 'Weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setStartDate(localDateKey(start));
      setEndDate(todayKey());
    } else if (type === 'Friday') {
      const friday = new Date(today);
      friday.setDate(today.getDate() - ((today.getDay() + 2) % 7));
      setStartDate(localDateKey(friday));
      setEndDate(localDateKey(friday));
    } else if (type === 'Monthly') {
      setStartDate(`${reportMonth}-01`);
      setEndDate(todayKey());
    }
  }

  async function exportFiltered(filename, rows, message) {
    try {
      await exportCsv(filename, rows);
      notify(message);
    } catch (error) {
      window.console.error('Unable to export report.', error);
      notify(error instanceof Error ? `Export failed: ${error.message}` : 'Report export failed.');
    }
  }

  function exportAttendanceReport() {
    const rows = [
      ['Employee', 'Employee ID', 'Date', 'Status', 'Overtime hours', 'Salary earned', 'Overtime earnings', 'Remarks'],
      ...filteredRows.map((item) => [item.employee.name, item.employee.code, item.date, item.status, item.overtimeHours, item.salaryEarnings.toFixed(2), item.overtimeEarnings.toFixed(2), item.note]),
    ];
    return exportFiltered(`attan-${reportType.toLowerCase()}-attendance-${state.activeCompanyId}-${startDate}`, rows, 'Attendance report downloaded.');
  }

  function exportPayroll() {
    const rows = [
      ['Employee', 'Employee ID', 'Date', 'Attendance salary', 'Overtime hours', 'Overtime earnings', 'Total earnings'],
      ...filteredRows.map((item) => [item.employee.name, item.employee.code, item.date, item.salaryEarnings.toFixed(2), item.overtimeHours, item.overtimeEarnings.toFixed(2), (item.salaryEarnings + item.overtimeEarnings).toFixed(2)]),
    ];
    return exportFiltered(`attan-salary-ledger-${state.activeCompanyId}-${startDate}`, rows, 'Salary ledger downloaded.');
  }
  const exportRows = [
    ['Employee', 'Employee ID', 'Date', 'Status', 'Overtime hours', 'Salary earned', 'Overtime earnings', 'Remarks'],
    ...filteredRows.map((item) => [item.employee.name, item.employee.code, item.date, item.status, item.overtimeHours, Number(item.salaryEarnings.toFixed(2)), Number(item.overtimeEarnings.toFixed(2)), item.note]),
  ];
  async function exportSpreadsheet() {
    try {
      await exportXlsx(`attan-${reportType.toLowerCase()}-report-${startDate}`, 'Attendance report', exportRows);
      notify('Excel report downloaded.');
    } catch (error) {
      window.console.error('Unable to export Excel report.', error);
      notify(error instanceof Error ? `Export failed: ${error.message}` : 'Excel report export failed.');
    }
  }
  async function exportPdfReport() {
    try {
      await exportPdf(`attan-${reportType.toLowerCase()}-report-${startDate}`, `${reportType} attendance · ${company?.name ?? 'Attan'}`, exportRows);
      notify('PDF report downloaded.');
    } catch (error) {
      window.console.error('Unable to export PDF report.', error);
      notify(error instanceof Error ? `Export failed: ${error.message}` : 'PDF report export failed.');
    }
  }
  return <>
    <div className="screen-intro"><div><p className="eyebrow">INSIGHTS & EXPORTS</p><h2>Reports that keep you in sync</h2><p>Filter saved attendance and payroll data for {company?.name ?? 'your workspace'}.</p></div></div>
    <Card className="report-filters"><label className="field"><span>Report type</span><select value={reportType} onChange={(event) => chooseReportType(event.target.value)}>{['Daily', 'Weekly', 'Friday', 'Monthly', 'Custom', 'Overtime', 'Salary', 'Holiday', 'Absent', 'Half Day'].map((type) => <option key={type}>{type}</option>)}</select></label><label className="field"><span>Employee</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="All">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label className="field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All statuses</option>{attendanceStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>{reportType === 'Monthly' && <label className="field"><span>Month</span><input type="month" value={reportMonth} onChange={(event) => { if (!event.target.value) return; setReportMonth(event.target.value); setStartDate(`${event.target.value}-01`); setEndDate(todayKey().slice(0, 7) === event.target.value ? todayKey() : lastDayOfMonth(event.target.value)); }} /></label>}<label className="field"><span>Start date</span><input type="date" value={startDate} max={todayKey()} onChange={(event) => { if (event.target.value) setStartDate(event.target.value); }} /></label><label className="field"><span>End date</span><input type="date" value={endDate} min={startDate} max={todayKey()} onChange={(event) => { if (event.target.value) setEndDate(event.target.value); }} /></label></Card>
    <div className="report-summary">
      <div><span className="report-summary-icon green"><Check size={17} /></span><small>Present days</small><strong>{presentDays}</strong><span>Across your team</span></div>
      <div><span className="report-summary-icon rose"><X size={17} /></span><small>Absent days</small><strong>{absentDays}</strong><span>Recorded this month</span></div>
      <div><span className="report-summary-icon amber"><Clock3 size={17} /></span><small>Half days</small><strong>{halfDays}</strong><span>{holidays} holidays / week-offs</span></div>
      <div><span className="report-summary-icon blue"><Clock3 size={17} /></span><small>Overtime hours</small><strong>{overtimeHours}</strong><span>Approved entries</span></div>
      <div><span className="report-summary-icon green"><Wallet size={17} /></span><small>Salary earned</small><strong>{currency(totalEarned)}</strong><span>{currency(totalPaid)} paid</span></div>
      <div><span className="report-summary-icon blue"><Wallet size={17} /></span><small>Account balance</small><strong>{currency(remainingBalance)}</strong><span>Current contribution ledger</span></div>
    </div>
    <Card className="report-table-card"><div className="section-heading"><div><h2>{reportType} attendance report</h2><p>{startDate} through {endDate} · {filteredRows.length} saved attendance entries</p></div><span className="report-chip">{company?.name}</span></div>
      {filteredRows.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Date</th><th>Team member</th><th>Status</th><th>Overtime</th><th>Salary</th><th>OT earnings</th><th>Remarks</th></tr></thead><tbody>{filteredRows.map((item) => <tr key={`${item.employee.id}-${item.date}`}><td>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className="report-person"><Avatar employee={item.employee} /><span><strong>{item.employee.name}</strong><small>{item.employee.code}</small></span></span></td><td><span className={`status-tag ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</span></td><td>{item.overtimeHours}h</td><td>{currency(item.salaryEarnings)}</td><td>{currency(item.overtimeEarnings)}</td><td>{item.note || '—'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><BarChart3 size={26} /><strong>No records match these filters</strong><p>Try a different employee, report type, or date range.</p></div>}
      <div className="report-actions"><Button variant="secondary" onClick={exportAttendanceReport}><Download size={15} /> CSV</Button><Button onClick={exportSpreadsheet}><Download size={15} /> Excel</Button><Button variant="outline" onClick={exportPdfReport}><Download size={15} /> PDF</Button><Button variant="outline" onClick={exportAttendanceReport}><FileText size={15} /> Sheets CSV</Button><Button variant="outline" onClick={exportPayroll}><Download size={15} /> Salary ledger</Button><Button variant="outline" onClick={exportAttendance}><Download size={15} /> Full history</Button></div>
    </Card>
  </>;
}

function ProfilePage({ employee, company, state, go, exportAttendance }) {
  return <>
    <div className="profile-hero"><Avatar employee={employee} size="large" /><div className="profile-hero-info"><span className="hero-kicker">WORKSPACE PROFILE</span><h2>{employee?.name ?? 'Workspace admin'}</h2><p>{employee?.designation ?? 'Administrator'}{employee?.department ? ` · ${employee.department}` : ''}</p><span className="profile-company"><Building2 size={14} />{company?.name ?? 'Your company'}</span></div><Button variant="secondary" onClick={() => go('employees')}><Settings size={15} /> Manage profile</Button></div>
    <div className="profile-grid">
      <Card><div className="section-heading"><div><h2>Personal details</h2><p>Your workspace identity</p></div></div><div className="profile-details">{[['Employee ID', employee?.code], ['Email', employee?.email], ['Phone', employee?.phone], ['Department', employee?.department], ['Shift', employee ? `${employee.shiftStart} – ${employee.shiftEnd}` : null], ['Company', company?.name]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 'Not added'}</strong></div>)}</div></Card>
      <Card><div className="section-heading"><div><h2>Preferences & tools</h2><p>Personalize your workspace</p></div></div><div className="profile-preferences"><button className="settings-link" onClick={() => state.setTheme(state.theme === 'dark' ? 'light' : 'dark')}><span className="profile-tool-icon"><Moon size={17} /></span><span><strong>Appearance</strong><small>{state.theme === 'dark' ? 'Dark mode is on' : 'Light mode is on'}</small></span><span className={`toggle ${state.theme === 'dark' ? 'on' : ''}`}><i /></span></button><button className="settings-link" onClick={() => go('employees')}><span className="profile-tool-icon"><Users size={17} /></span><span><strong>Employee directory</strong><small>View team and salary settings</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={() => go('companies')}><span className="profile-tool-icon"><Building2 size={17} /></span><span><strong>Company workspace</strong><small>{state.companies.length} companies available</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={exportAttendance}><span className="profile-tool-icon"><Download size={17} /></span><span><strong>Export attendance</strong><small>Download a CSV for this company</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={() => go('settings')}><span className="profile-tool-icon"><Settings size={17} /></span><span><strong>More settings</strong><small>Workspace data and reminders</small></span><ArrowRight size={16} /></button></div></Card>
    </div>
  </>;
}

function EmployeesPage({ employees, allEmployees, query, setQuery, department, setDepartment, edit, remove }) {
  const departments = ['All', ...new Set(allEmployees.map((item) => item.department).filter(Boolean))];
  return <>
    <div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID, department..." /></label><select className="select-field" value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</select><span className="muted">{employees.length} members</span></div>
    <div className="employee-grid">{employees.map((employee) => <Card className="employee-card" key={employee.id} onClick={() => edit(employee)} ariaLabel={`Edit ${employee.name}`}><div className="employee-card-top"><Avatar employee={employee} size="large" /><span className={`status-tag ${employee.status}`}>{employee.status}</span></div><h3>{employee.name}</h3><p>{employee.designation}</p><div className="employee-meta"><span>{employee.code}</span><span>{employee.department}</span></div><div className="employee-salary"><span>Monthly salary</span><strong>{currency(employee.salary.monthlySalary)}</strong></div><div className="employee-salary"><span>Per day · {employee.salary.workingDaysPerMonth} days</span><strong>{currency(employee.salary.perDaySalary)}</strong></div><div className="card-actions"><Button variant="secondary" onClick={() => edit(employee)}>Edit employee</Button><button className="danger-text" onClick={() => remove(employee)}>Delete</button></div></Card>)}</div>
    {!employees.length && <div className="empty-state large"><Users size={30} /><strong>No employees found</strong><p>Try changing the search or department filter, or add an employee.</p></div>}
  </>;
}

function AttendancePage({ state, employees, selected, selectEmployee, session, todaySession, correction, workMs, workHours, now, notify }) {
  const [status, setStatus] = useState('Present');
  const [note, setNote] = useState('');
  const [overtime, setOvertime] = useState('1');
  const [attendanceOvertime, setAttendanceOvertime] = useState('0');
  const [customAttendanceOvertime, setCustomAttendanceOvertime] = useState('1');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const requests = state.overtimeRequests.filter((item) => item.date === todayKey() && employees.some((employee) => employee.id === item.employeeId));
  if (!selected) return <div className="empty-state large"><Users size={30} /><strong>No active employees</strong><p>Add an employee before tracking attendance.</p></div>;
  const selectedDateSession = state.sessions.find((item) => item.employeeId === selected.id && item.date === selectedDate);
  const selectedDateCorrection = state.attendanceAdjustments.find((item) => item.employeeId === selected.id && item.date === selectedDate);
  const dateHistory = state.attendanceHistory.filter((item) => item.employeeId === selected.id && item.date === selectedDate).slice(-5).reverse();
  const calendarDays = monthDates(calendarMonth);
  const approved = requests.filter((item) => item.employeeId === selected.id && item.status === 'approved').reduce((sum, item) => sum + (item.approvedHours ?? item.requestedHours), 0);
  const attendanceRecords = employees.map((employee) => {
    const employeeSession = state.sessions.find((item) => item.employeeId === employee.id && item.date === todayKey());
    const adjustment = state.attendanceAdjustments.find((item) => item.employeeId === employee.id && item.date === todayKey());
    const recordStatus = adjustment?.status ?? employeeSession?.status ?? 'not-started';
    const workedMs = sessionWorkMilliseconds(employeeSession, now);
    return { employee, session: employeeSession, adjustment, recordStatus, workedMs };
  });
  const markedCount = attendanceRecords.filter(({ session: item, adjustment }) => item || adjustment).length;
  const workingCount = attendanceRecords.filter(({ session: item }) => item?.status === 'working').length;
  const breakCount = attendanceRecords.filter(({ session: item }) => item?.status === 'break').length;
  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const visibleRecords = attendanceRecords.filter(({ employee, session: item, adjustment }) => {
    const searchText = `${employee.name} ${employee.code} ${employee.department}`.toLowerCase();
    const matchesSearch = searchText.includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'All'
      || (filter === 'Working' && item?.status === 'working')
      || (filter === 'On break' && item?.status === 'break')
      || (filter === 'Not started' && !item && !adjustment);
    return matchesSearch && matchesFilter;
  });
  async function mark(statusValue) {
    const overtimeHours = attendanceOvertime === 'custom' ? Number(customAttendanceOvertime) : Number(attendanceOvertime);
    if (!Number.isFinite(overtimeHours) || overtimeHours < 0 || overtimeHours > 24) return window.alert('Enter overtime between 0 and 24 hours.');
    try {
      await state.markAttendance(selected.id, selectedDate, statusValue, note.trim(), overtimeHours);
      setNote('');
      notify(`Attendance updated for ${selected.name}.`);
    } catch (error) {
      window.console.error('Unable to update attendance.', error);
      notify(error instanceof Error ? error.message : 'Unable to update attendance.');
    }
  }
  function chooseCalendarDate(dateKey) {
    if (!dateKey) return;
    setSelectedDate(dateKey);
    const adjustment = state.attendanceAdjustments.find((item) => item.employeeId === selected.id && item.date === dateKey);
    const hours = Number(adjustment?.overtimeHours ?? 0);
    if (hours <= 4 && Number.isInteger(hours)) setAttendanceOvertime(String(hours));
    else {
      setAttendanceOvertime('custom');
      setCustomAttendanceOvertime(String(hours));
    }
    if (adjustment) {
      setStatus(adjustment.status);
      setNote(adjustment.note ?? '');
    } else {
      setStatus('Present');
      setNote('');
    }
  }
  async function removeSelectedAttendance() {
    if (!selectedDateCorrection || selectedDateSession) return;
    if (!window.confirm(`Delete ${selected.name}'s attendance for ${selectedDate}?`)) return;
    await state.deleteAttendance(selected.id, selectedDate);
    notify('Attendance entry deleted and its salary credits reversed.');
  }
  function requestOvertime() {
    const hours = Number(overtime);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return window.alert('Enter overtime between 0.5 and 24 hours.');
    if (state.overtimeRequests.some((item) => item.employeeId === selected.id && item.date === todayKey() && item.status === 'pending')) return window.alert('This employee already has a pending request today.');
    state.requestOvertime(selected.id, hours);
    notify('Overtime request submitted.');
  }
  return <>
    <div className="attendance-heading">
      <div><p className="eyebrow">LIVE TEAM OVERVIEW</p><h2>Attendance today</h2><p>Track check-ins, shifts and attendance exceptions in one place.</p></div>
      <span className="date-pill"><CalendarDays size={15} />{new Date(`${todayKey()}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </div>
    <div className="attendance-summary">
      <div className="attendance-stat"><span className="attendance-stat-icon indigo"><Users size={17} /></span><span><small>Team size</small><strong>{employees.length}</strong></span></div>
      <div className="attendance-stat"><span className="attendance-stat-icon green"><Check size={17} /></span><span><small>Attendance marked</small><strong>{markedCount}<em> / {employees.length}</em></strong></span></div>
      <div className="attendance-stat"><span className="attendance-stat-icon blue"><Clock3 size={17} /></span><span><small>Working now</small><strong>{workingCount}</strong><em>{breakCount} on break</em></span></div>
      <div className="attendance-stat"><span className="attendance-stat-icon amber"><LogIn size={17} /></span><span><small>Pending overtime</small><strong>{pendingCount}</strong></span></div>
    </div>
    <Card className="attendance-roster-panel">
      <div className="section-heading"><div><h2>Team attendance</h2><p>Select an employee to manage their attendance.</p></div><span className="roster-count">{visibleRecords.length} employees</span></div>
      <div className="attendance-toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID, department..." /></label>
        <select className="select-field" aria-label="Filter attendance" value={filter} onChange={(event) => setFilter(event.target.value)}>{['All', 'Working', 'On break', 'Not started'].map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {visibleRecords.length ? <div className="attendance-roster">{visibleRecords.map(({ employee, session: employeeSession, adjustment, recordStatus, workedMs }) => {
        const progress = Math.min(100, workedMs / (employee.requiredHours * 3600000) * 100);
        const statusLabel = adjustment?.status ?? (employeeSession?.status === 'clocked-out' ? 'Completed' : employeeSession?.status === 'working' ? 'Working' : employeeSession?.status === 'break' ? 'On break' : 'Not started');
        const statusClass = statusLabel.toLowerCase().replace(/\s+/g, '-');
        return <button type="button" className={`attendance-employee-card ${employee.id === selected.id ? 'selected' : ''}`} key={employee.id} onClick={() => selectEmployee(employee.id)}>
          <div className="attendance-employee-heading"><Avatar employee={employee} /><span className={`status-tag ${statusClass}`}>{statusLabel}</span></div>
          <strong className="attendance-employee-name">{employee.name}</strong>
          <span className="attendance-employee-meta">{employee.code} · {employee.designation}</span>
          <div className="attendance-employee-shift"><span>{employee.department}</span><span>{employee.shiftStart}–{employee.shiftEnd}</span></div>
          <div className="attendance-employee-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{formatDuration(workedMs)} / {employee.requiredHours}h</small></div>
          {recordStatus === 'not-started' && <span className="attendance-card-hint">Select to clock in <ArrowRight size={13} /></span>}
        </button>;
      })}</div> : <div className="empty-inline">No employees match this search or filter.</div>}
    </Card>
    <Card className="calendar-card">
      <div className="section-heading"><div><p className="eyebrow">MONTHLY VIEW</p><h2>{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><p>Choose a past or current day to review or update attendance.</p></div><div className="calendar-controls"><button className="icon-button" aria-label="Previous month" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Next month" disabled={calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth()} onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div></div>
      <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{calendarDays.map((date) => {
        const dateKey = localDateKey(date);
        const dateSession = state.sessions.find((item) => item.employeeId === selected.id && item.date === dateKey);
        const dateAdjustment = state.attendanceAdjustments.find((item) => item.employeeId === selected.id && item.date === dateKey);
        const dateStatus = dateAdjustment?.status ?? dateSession?.status ?? '';
        const statusClass = dateStatus.toLowerCase().replace(/\s+/g, '-');
        const future = dateKey > todayKey();
        return <button key={dateKey} type="button" className={`calendar-day ${date.getMonth() === calendarMonth.getMonth() ? '' : 'outside'} ${dateKey === selectedDate ? 'selected' : ''} ${dateKey === todayKey() ? 'today' : ''} ${statusClass}`} disabled={future} onClick={() => chooseCalendarDate(dateKey)} aria-label={`${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}${dateStatus ? `, ${dateStatus}` : ''}`}>
          <span>{date.getDate()}</span>{dateStatus && <i />}
        </button>;
      })}</div>
      <div className="calendar-legend"><span><i className="legend-present" />Present</span><span><i className="legend-half" />Half day</span><span><i className="legend-absent" />Absent</span><span><i className="legend-holiday" />Holiday</span><span><i className="legend-weekoff" />Week off</span><span><i className="legend-leave" />Leave</span></div>
      <div className="calendar-edit"><span><strong>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong><small>{selectedDateCorrection?.status ?? (selectedDateSession ? selectedDateSession.status === 'clocked-out' ? 'Completed shift' : selectedDateSession.status : 'No attendance record')}</small></span><div className="calendar-edit-form"><input type="date" className="text-input" value={selectedDate} max={todayKey()} onChange={(event) => chooseCalendarDate(event.target.value)} aria-label="Choose attendance date" /><select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Selected date attendance status">{attendanceStatuses.map((item) => <option key={item}>{item}</option>)}</select><select className="select-field" value={attendanceOvertime} onChange={(event) => setAttendanceOvertime(event.target.value)} aria-label="Overtime hours"><option value="0">0h OT</option><option value="1">1h OT</option><option value="2">2h OT</option><option value="3">3h OT</option><option value="4">4h OT</option><option value="custom">Custom OT</option></select>{attendanceOvertime === 'custom' && <input className="text-input" type="number" min="0" max="24" step="0.5" value={customAttendanceOvertime} onChange={(event) => setCustomAttendanceOvertime(event.target.value)} aria-label="Custom overtime hours" />}<Button variant="secondary" disabled={selectedDate > todayKey()} onClick={() => mark(status)}><Check size={14} /> Save</Button>{selectedDateCorrection && !selectedDateSession && <Button variant="danger" onClick={removeSelectedAttendance} aria-label="Delete attendance entry"><X size={14} /></Button>}</div></div>
      {dateHistory.length > 0 && <div className="attendance-history"><strong>Change history</strong>{dateHistory.map((item) => <div key={item.id}><span>{new Date(item.changedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><small>{item.previousStatus ? `${item.previousStatus} → ` : ''}{item.status}{item.overtimeHours ? ` · ${item.overtimeHours}h OT` : ''}{item.previousSalaryEarnings !== item.salaryEarnings ? ` · ${currency(item.previousSalaryEarnings)} → ${currency(item.salaryEarnings)}` : ''}</small></div>)}</div>}
    </Card>
    <div className="attendance-detail-heading"><div><p className="eyebrow">EMPLOYEE ATTENDANCE</p><h2>Manage {selected.name}</h2></div><span className="muted">Shift {selected.shiftStart}–{selected.shiftEnd}</span></div>
    <div className="attendance-detail-layout">
      <Card className="attendance-main"><div className="employee-inline"><Avatar employee={selected} size="large" /><div><h2>{selected.name}</h2><p>{selected.code} · {selected.designation}</p></div><span className={`status-tag ${(correction?.status ?? session?.status ?? todaySession?.status ?? 'not-started').toLowerCase().replace(/\s+/g, '-')}`}>{correction?.status ?? (session?.status === 'clocked-out' ? 'Completed' : session?.status === 'break' ? 'On break' : session?.status === 'working' ? 'Working' : todaySession?.status ?? 'Not started')}</span></div>
        <div className="timer-panel"><span>WORK TIME TODAY</span><strong>{formatDuration(workMs)}</strong><p>{workHours.toFixed(2)} hours logged · {Math.max(0, selected.requiredHours - workHours).toFixed(2)} hours remaining</p><div className="progress-track"><span style={{ width: `${Math.min(100, workHours / selected.requiredHours * 100)}%` }} /></div><small>Required shift: {selected.requiredHours} hours · Approved overtime: {approved} hours</small></div>
        <div className="clock-actions"><Button disabled={!!todaySession} onClick={() => state.clockIn(selected.id)}><LogIn size={16} /> Clock in</Button><Button variant="secondary" disabled={session?.status !== 'working'} onClick={() => state.startBreak(selected.id)}><Coffee size={16} /> Start break</Button><Button variant="success" disabled={session?.status !== 'break'} onClick={() => state.resumeWork(selected.id)}><Clock3 size={16} /> Resume work</Button><Button variant="outline" disabled={!session} onClick={() => state.clockOut(selected.id)}><LogOut size={16} /> Clock out</Button></div>
        <div className="correction-panel"><h3>Manual attendance correction</h3><p>Overrides attendance status for {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.</p><div className="inline-form"><select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>{attendanceStatuses.map((item) => <option key={item}>{item}</option>)}</select><input className="text-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (optional)" /><Button variant="secondary" disabled={selectedDate > todayKey()} onClick={() => mark(status)}>Save status</Button></div>{selectedDateCorrection && <p className="audit-note">Current override: <strong>{selectedDateCorrection.status}</strong>{selectedDateCorrection.note ? ` · ${selectedDateCorrection.note}` : ''}</p>}{correction && selectedDate === todayKey() && !selectedDateCorrection && <p className="audit-note">Current override: <strong>{correction.status}</strong>{correction.note ? ` · ${correction.note}` : ''}</p>}</div>
      </Card>
      <div className="attendance-side-stack">
        <Card className="overtime-card"><div className="section-heading"><div><h2>Overtime requests</h2><p>Rate: {currency(selected.salary.overtimeRate)} per hour</p></div><Clock3 size={19} /></div><div className="inline-form"><input className="text-input" type="number" min="0.5" max="24" step="0.5" value={overtime} onChange={(event) => setOvertime(event.target.value)} aria-label="Overtime hours" /><Button onClick={requestOvertime}><Plus size={15} /> Request</Button></div>{requests.length ? requests.map((item) => {
        const employee = state.employees.find((person) => person.id === item.employeeId);
        return <div className="request-item" key={item.id}><div><strong>{employee?.name ?? 'Employee'} · {item.requestedHours}h</strong><span>{item.status}{item.extraHours ? ` · ${item.extraHours.toFixed(1)}h extra` : ''}</span></div>{item.status === 'pending' && <div className="request-actions"><button onClick={() => state.setOvertimeStatus(item.id, 'approved')}>Approve</button><button onClick={() => state.setOvertimeStatus(item.id, 'rejected')}>Reject</button></div>}</div>;
      }) : <p className="empty-inline">No overtime requests today.</p>}</Card>
        <Card className="timeline-card"><div className="section-heading"><div><h2>Today&apos;s timeline</h2><p>Attendance events for {selected.name}</p></div></div>{todaySession ? <div className="timeline"><p><strong>Clocked in</strong><span>{new Date(todaySession.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>{todaySession.breaks.map((item) => <p key={item.id}><strong>Break · {item.endAt ? formatDuration(item.endAt - item.startAt) : 'In progress'}</strong><span>{new Date(item.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>)}{todaySession.clockOutAt && <p><strong>Clocked out</strong><span>{new Date(todaySession.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>}</div> : <div className="empty-inline">No clock events recorded today.</div>}</Card>
      </div>
    </div>
  </>;
}

function CompaniesPage({ state, setModal, go }) {
  return <div className="company-grid">{state.companies.map((company) => {
    const count = state.employees.filter((employee) => employee.companyId === company.id).length;
    const active = company.id === state.activeCompanyId;
    return <Card className="company-card" key={company.id} onClick={() => { state.setActiveCompany(company.id); go('dashboard'); }} ariaLabel={`Switch to ${company.name}`}><div className="company-heading"><span className="company-logo" style={{ backgroundColor: company.color }}>{company.name[0]}</span><div><h2>{company.name}</h2><p>{count} employees · {company.address || 'No address'}</p></div>{active && <span className="active-label"><Check size={13} />Active</span>}</div><div className="company-details"><span>{company.email || 'No email'} · {company.phone || 'No phone'}</span></div><div className="card-actions"><Button variant={active ? 'secondary' : 'outline'} onClick={() => { state.setActiveCompany(company.id); go('dashboard'); }}>{active ? 'Current company' : 'Switch to company'}</Button><Button variant="outline" onClick={() => setModal({ type: 'company', company })}>Edit company</Button>{state.companies.length > 1 && <button className="danger-text" onClick={() => { if (window.confirm(`Delete ${company.name} and all associated local records?`)) { state.deleteCompany(company.id); } }}>Delete</button>}</div></Card>;
  })}</div>;
}

function SettingsPage({ state, company, exportAttendance, setPage }) {
  const admin = state.employees.find((item) => item.companyId === state.activeCompanyId && item.role === 'admin') ?? state.employees.find((item) => item.companyId === state.activeCompanyId);
  const reminderTimes = state.reminderTimes ?? ['18:00', '19:00', '20:00'];
  return <div className="settings-grid"><Card><div className="profile-summary"><Avatar employee={admin} size="large" /><div><h2>{admin?.name ?? 'Workspace admin'}</h2><p>{admin?.designation ?? 'Administrator'} · {company?.name}</p></div></div><div className="setting-row"><div className="setting-icon"><Sun size={18} /></div><div><strong>Dark appearance</strong><span>Switch the dashboard theme</span></div><button className={`toggle ${state.theme === 'dark' ? 'on' : ''}`} onClick={() => state.setTheme(state.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode"><i /></button></div><div className="setting-row"><div className="setting-icon amber"><Clock3 size={18} /></div><div><strong>Attendance reminders</strong><span>In-app alerts while this workspace is open.</span></div><button className={`toggle ${state.remindersEnabled ? 'on' : ''}`} onClick={() => state.setRemindersEnabled(!state.remindersEnabled)} aria-label="Toggle attendance reminders"><i /></button></div><div className="reminder-settings"><span>Reminder times</span><div>{reminderTimes.map((time, index) => <label key={`${index}-${time}`}><span>Reminder {index + 1}</span><input type="time" value={time} onChange={(event) => state.setReminderTimes(reminderTimes.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>)}</div><small>Reminders stop for today after attendance is recorded.</small></div></Card><Card><div className="section-heading"><div><h2>Workspace</h2><p>Manage your HR workspace data.</p></div></div><button className="settings-link" onClick={() => setPage('companies')}><Building2 size={18} /><span><strong>Manage companies</strong><small>{state.companies.length} companies · switch or edit</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={() => admin && setPage('employees')}><Users size={18} /><span><strong>Employee directory</strong><small>Personal details, salary and shift settings</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={exportAttendance}><Download size={18} /><span><strong>Export attendance CSV</strong><small>Download this company&apos;s attendance history</small></span><ArrowRight size={16} /></button><div className="storage-note">Your HRMS data is stored locally in this browser.</div></Card></div>;
}

function QuickAttendanceModal({ employees, attendance, onClose, onSave }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [status, setStatus] = useState('Present');
  const [note, setNote] = useState('');
  const [overtime, setOvertime] = useState('0');
  const [customHours, setCustomHours] = useState('1');
  const existing = attendance.find((item) => item.employeeId === employeeId && item.date === todayKey());
  const date = todayKey();

  useEffect(() => {
    setStatus(existing?.status ?? 'Present');
    setNote(existing?.note ?? '');
    const hours = Number(existing?.overtimeHours ?? 0);
    if (hours <= 4 && Number.isInteger(hours)) setOvertime(String(hours));
    else {
      setOvertime('custom');
      setCustomHours(String(hours));
    }
  }, [employeeId, existing?.updatedAt]);

  function submit(event) {
    event.preventDefault();
    if (!employeeId) return;
    const overtimeHours = overtime === 'custom' ? Number(customHours) : Number(overtime);
    if (!Number.isFinite(overtimeHours) || overtimeHours < 0 || overtimeHours > 24) return window.alert('Enter overtime between 0 and 24 hours.');
    onSave({ employeeId, date, status, note: note.trim(), overtimeHours });
  }

  return <Modal title="Mark attendance" onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      {employees.length ? <>
        <p className="modal-copy">Record or update today&apos;s attendance. Existing entries are updated rather than duplicated.</p>
        <p className="attendance-modal-date"><CalendarDays size={15} />{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        <label className="field"><span>Employee</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}</select></label>
        <label className="field"><span>Attendance status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{attendanceStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Overtime</span><select value={overtime} onChange={(event) => setOvertime(event.target.value)}><option value="0">0 hours</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option><option value="custom">Custom hours</option></select></label>
        {overtime === 'custom' && <Field label="Custom overtime hours" type="number" min="0" max="24" step="0.5" value={customHours} onChange={(event) => setCustomHours(event.target.value)} required />}
        <Field label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a reason or note" />
        {existing && <p className="form-hint">Current entry: {existing.status}{existing.overtimeHours ? ` · ${existing.overtimeHours}h overtime` : ''}. Saving replaces its salary credits.</p>}
      </> : <div className="empty-inline">There are no active employees to mark attendance for.</div>}
      <footer className="modal-actions"><span /><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!employees.length}><Check size={15} /> Save attendance</Button></footer>
    </form>
  </Modal>;
}

function EmployeeModal({ employee, onClose, onSave, onDelete }) {
  const salary = employee?.salary ?? {};
  const [form, setForm] = useState({
    id: employee?.id ?? '', name: employee?.name ?? '', code: employee?.code ?? '', email: employee?.email ?? '', phone: employee?.phone ?? '',
    designation: employee?.designation ?? '', department: employee?.department ?? '', monthlySalary: salary.monthlySalary ?? 50000,
    workingDaysPerMonth: salary.workingDaysPerMonth ?? 26, perDaySalary: salary.perDaySalary ?? (salary.monthlySalary ?? 50000) / (salary.workingDaysPerMonth ?? 26),
    halfDaySalary: salary.halfDaySalary ?? (salary.perDaySalary ?? (salary.monthlySalary ?? 50000) / (salary.workingDaysPerMonth ?? 26)) / 2,
    paidLeaveSalary: salary.paidLeaveSalary ?? salary.perDaySalary ?? (salary.monthlySalary ?? 50000) / (salary.workingDaysPerMonth ?? 26),
    unpaidLeaveDeduction: salary.unpaidLeaveDeduction ?? salary.perDaySalary ?? (salary.monthlySalary ?? 50000) / (salary.workingDaysPerMonth ?? 26),
    overtimeRate: salary.overtimeRate ?? 150, allowances: salary.allowances ?? 0, deductions: salary.deductions ?? 0,
    requiredHours: employee?.requiredHours ?? 8, fullDayHours: salary.fullDayHours ?? 8, halfDayHours: salary.halfDayHours ?? 4,
    shiftStart: employee?.shiftStart ?? '09:00', shiftEnd: employee?.shiftEnd ?? '17:00',
  });
  function change(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'monthlySalary' || name === 'workingDaysPerMonth') {
        const days = Number(name === 'workingDaysPerMonth' ? value : current.workingDaysPerMonth);
        const monthly = Number(name === 'monthlySalary' ? value : current.monthlySalary);
        if (days > 0 && monthly >= 0) {
          next.perDaySalary = (monthly / days).toFixed(2);
          next.halfDaySalary = (monthly / days / 2).toFixed(2);
          next.paidLeaveSalary = (monthly / days).toFixed(2);
          next.unpaidLeaveDeduction = (monthly / days).toFixed(2);
        }
      }
      return next;
    });
  }
  function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.designation.trim() || !form.department.trim()) return window.alert('Name, employee ID, designation and department are required.');
    onSave(form);
  }
  return <Modal title={employee ? 'Edit employee' : 'Add employee'} onClose={onClose} wide><form className="modal-form" onSubmit={submit}><div className="form-section"><h3>Personal information</h3><div className="form-grid"><Field label="Full name" value={form.name} onChange={(event) => change('name', event.target.value)} required /><Field label="Employee ID" value={form.code} onChange={(event) => change('code', event.target.value)} required /><Field label="Email" type="email" value={form.email} onChange={(event) => change('email', event.target.value)} /><Field label="Phone" value={form.phone} onChange={(event) => change('phone', event.target.value)} /><Field label="Designation" value={form.designation} onChange={(event) => change('designation', event.target.value)} required /><Field label="Department" value={form.department} onChange={(event) => change('department', event.target.value)} required /></div></div><div className="form-section"><h3>Shift and attendance</h3><div className="form-grid"><Field label="Working days per month" type="number" min="1" max="31" value={form.workingDaysPerMonth} onChange={(event) => change('workingDaysPerMonth', event.target.value)} required /><Field label="Required hours per day" type="number" min="1" max="24" step="0.5" value={form.requiredHours} onChange={(event) => change('requiredHours', event.target.value)} /><Field label="Full-day threshold (hours)" type="number" min="1" max="24" step="0.5" value={form.fullDayHours} onChange={(event) => change('fullDayHours', event.target.value)} /><Field label="Half-day threshold (hours)" type="number" min="0" max="24" step="0.5" value={form.halfDayHours} onChange={(event) => change('halfDayHours', event.target.value)} /><Field label="Shift starts" type="time" value={form.shiftStart} onChange={(event) => change('shiftStart', event.target.value)} /><Field label="Shift ends" type="time" value={form.shiftEnd} onChange={(event) => change('shiftEnd', event.target.value)} /></div></div><div className="form-section"><h3>Salary settings</h3><div className="form-grid"><Field label="Monthly salary (₹)" type="number" min="0" value={form.monthlySalary} onChange={(event) => change('monthlySalary', event.target.value)} required /><Field label="Per-day salary (₹)" type="number" min="0" step="0.01" value={form.perDaySalary} onChange={(event) => change('perDaySalary', event.target.value)} required /><Field label="Half-day salary (₹)" type="number" min="0" step="0.01" value={form.halfDaySalary} onChange={(event) => change('halfDaySalary', event.target.value)} /><Field label="Paid leave salary (₹)" type="number" min="0" step="0.01" value={form.paidLeaveSalary} onChange={(event) => change('paidLeaveSalary', event.target.value)} /><Field label="Unpaid leave deduction (₹)" type="number" min="0" step="0.01" value={form.unpaidLeaveDeduction} onChange={(event) => change('unpaidLeaveDeduction', event.target.value)} /><Field label="Overtime rate / hour (₹)" type="number" min="0" value={form.overtimeRate} onChange={(event) => change('overtimeRate', event.target.value)} /><Field label="Monthly allowances (₹)" type="number" min="0" value={form.allowances} onChange={(event) => change('allowances', event.target.value)} /><Field label="Monthly deductions (₹)" type="number" min="0" value={form.deductions} onChange={(event) => change('deductions', event.target.value)} /></div><p className="form-hint">Per-day and related rates recalculate when monthly salary or working days change. You can override each rate.</p></div><footer className="modal-actions">{employee && <Button type="button" variant="danger" onClick={() => { onDelete(employee); onClose(); }}>Delete employee</Button>}<span /><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><Check size={15} /> Save employee</Button></footer></form></Modal>;
}

function CompanyModal({ company, onClose, onSave }) {
  const [form, setForm] = useState({
    id: company?.id ?? '', name: company?.name ?? '', address: company?.address ?? '', email: company?.email ?? '', phone: company?.phone ?? '', registration: company?.registration ?? '', color: company?.color ?? colors[0],
    payWeeklyOff: company?.salaryPolicy?.payWeeklyOff ?? true, payPublicHoliday: company?.salaryPolicy?.payPublicHoliday ?? true,
  });
  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  return <Modal title={company ? 'Edit company' : 'Add company'} onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim()) return window.alert('Company name is required.'); onSave(form); }}><Field label="Company name" value={form.name} onChange={(event) => change('name', event.target.value)} required /><Field label="Address" value={form.address} onChange={(event) => change('address', event.target.value)} /><Field label="Email" type="email" value={form.email} onChange={(event) => change('email', event.target.value)} /><Field label="Phone" value={form.phone} onChange={(event) => change('phone', event.target.value)} /><Field label="Registration details" value={form.registration} onChange={(event) => change('registration', event.target.value)} /><div className="form-section"><h3>Paid time policies</h3><label className="policy-toggle"><input type="checkbox" checked={form.payWeeklyOff} onChange={(event) => change('payWeeklyOff', event.target.checked)} /><span>Pay weekly offs</span></label><label className="policy-toggle"><input type="checkbox" checked={form.payPublicHoliday} onChange={(event) => change('payPublicHoliday', event.target.checked)} /><span>Pay public holidays</span></label></div><div className="field"><span>Brand color</span><div className="color-options">{colors.map((color) => <button type="button" key={color} className={form.color === color ? 'chosen' : ''} style={{ background: color }} onClick={() => change('color', color)} aria-label={`Select ${color}`} />)}</div></div><footer className="modal-actions"><span /><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><Check size={15} /> Save company</Button></footer></form></Modal>;
}

export default App;
