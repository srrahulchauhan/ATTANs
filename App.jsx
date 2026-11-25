import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Building2, CalendarDays, Check, ChevronDown, Clock3,
  Coffee, Download, LayoutDashboard, LogIn, LogOut, Moon, Plus, Search,
  Settings, Sun, Users, X,
} from 'lucide-react';
import { useHrmsStore } from './store/hrmsStore.js';
import { exportCsv } from './services/exportService.web.js';
import { formatDuration, sessionWorkMilliseconds, todayKey } from './utils/timeCalculator.js';

const currency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const attendanceStatuses = ['Present', 'Half Day', 'Absent', 'Paid Leave', 'Unpaid Leave', 'Weekly Off', 'Public Holiday'];
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Clock3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

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
    <section
      className={`card ${className} ${onClick ? 'card-clickable' : ''}`}
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
    >
      {children}
    </section>
  );
}

function Button({ children, variant = 'primary', ...props }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
        {children}
      </section>
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
  const [page, setPage] = useState('dashboard');
  const [modal, setModal] = useState(null);
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
        halfDaySalary: perDaySalary / 2,
        perHourSalary: perDaySalary / 8,
        overtimeRate: Number(values.overtimeRate) || 0,
        paidLeaveSalary: perDaySalary,
        unpaidLeaveDeduction: perDaySalary,
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
      salaryPolicy: existing?.salaryPolicy ?? { payWeeklyOff: true, payPublicHoliday: true },
    };
    if (existing) state.updateCompany(item);
    else state.addCompany(item);
    setModal(null);
  }

  async function exportAttendance() {
    const rows = [
      ['Employee', 'Employee ID', 'Date', 'Clock in', 'Clock out', 'Working hours', 'Break sessions'],
      ...state.sessions.filter((item) => item.companyId === state.activeCompanyId).map((item) => {
        const employee = state.employees.find((person) => person.id === item.employeeId);
        return [employee?.name ?? '', employee?.code ?? '', item.date, new Date(item.clockInAt).toLocaleTimeString(), item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '', (item.workMs / 3600000).toFixed(2), item.breaks.length];
      }),
    ];
    await exportCsv(`attan-attendance-${state.activeCompanyId}-${todayKey()}`, rows);
  }

  const titleMap = { dashboard: ['PEOPLE & OPERATIONS', 'Dashboard'], employees: ['YOUR TEAM', 'Employees'], attendance: ['TIME & ATTENDANCE', 'Attendance'], settings: ['ACCOUNT & SETTINGS', 'Settings'], companies: ['WORKSPACE', 'Companies'] };
  const [eyebrow, title] = titleMap[page] ?? titleMap.dashboard;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>attan<small>PEOPLE OPERATIONS</small></span></div>
        <div className="workspace-picker">
          <span className="workspace-dot" style={{ backgroundColor: company?.color ?? colors[0] }} />
          <select aria-label="Active company" value={state.activeCompanyId} onChange={(event) => state.setActiveCompany(event.target.value)}>
            {state.companies.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'selected' : ''}`} onClick={() => setPage(id)}><Icon size={18} /><span>{label}</span></button>)}
          <button className={`nav-link ${page === 'companies' ? 'selected' : ''}`} onClick={() => setPage('companies')}><Building2 size={18} /><span>Companies</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="status-dot" />Local workspace is ready</div>
          <button className="profile-link" onClick={() => setPage('settings')}><span className="profile-badge">AS</span><span><strong>Workspace Admin</strong><small>{company?.name ?? 'Your company'}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumb">Workspace <span>/</span> {title}</div>
          <div className="topbar-actions"><span className="date-pill"><CalendarDays size={15} />{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><button className="theme-toggle" onClick={() => state.setTheme(state.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div>
        </header>
        <div className="content">
          {page !== 'attendance' && <PageTitle eyebrow={eyebrow} title={title} action={
            page === 'employees' ? <Button onClick={() => openEmployee(null)}><Plus size={16} /> Add employee</Button>
              : page === 'companies' ? <Button onClick={() => setModal({ type: 'company', company: null })}><Plus size={16} /> Add company</Button>
                : null
          } />}
          {page === 'dashboard' && <DashboardPage state={state} company={company} activeEmployees={activeEmployees} todaySessions={todaySessions} go={setPage} markAttendance={() => setModal({ type: 'quick-attendance' })} />}
          {page === 'employees' && <EmployeesPage employees={filteredEmployees} allEmployees={companyEmployees} query={query} setQuery={setQuery} department={department} setDepartment={setDepartment} edit={openEmployee} remove={removeEmployee} />}
          {page === 'attendance' && <AttendancePage state={state} employees={activeEmployees} selected={selectedEmployee} selectEmployee={setSelectedEmployeeId} session={session} todaySession={todaySession} correction={todayCorrection} workMs={workMs} workHours={workHours} now={now} />}
          {page === 'companies' && <CompaniesPage state={state} setModal={setModal} go={setPage} />}
          {page === 'settings' && <SettingsPage state={state} company={company} exportAttendance={exportAttendance} setPage={setPage} />}
        </div>
        <MobileNav page={page} setPage={setPage} />
      </main>
      {modal?.type === 'employee' && <EmployeeModal employee={modal.employee} onClose={() => setModal(null)} onSave={saveEmployee} onDelete={removeEmployee} />}
      {modal?.type === 'company' && <CompanyModal company={modal.company} onClose={() => setModal(null)} onSave={saveCompany} />}
      {modal?.type === 'quick-attendance' && <QuickAttendanceModal employees={activeEmployees} onClose={() => setModal(null)} onSave={async (entry) => { await state.markAttendance(entry.employeeId, todayKey(), entry.status, entry.note); setModal(null); }} />}
    </div>
  );
}

function MobileNav({ page, setPage }) {
  return <nav className="mobile-nav">{navItems.slice(0, 5).map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'selected' : ''} onClick={() => setPage(id)}><Icon size={19} /><span>{label}</span></button>)}</nav>;
}

function DashboardPage({ state, company, activeEmployees, todaySessions, go, markAttendance }) {
  const working = todaySessions.filter((item) => item.status === 'working').length;
  const breaks = todaySessions.filter((item) => item.status === 'break').length;
  const marked = new Set([...todaySessions.map((item) => item.employeeId), ...state.attendanceAdjustments.filter((item) => item.date === todayKey()).map((item) => item.employeeId)]).size;
  const activity = [...todaySessions].reverse().slice(0, 5);
  return <>
    <div className="welcome-strip"><div><h2>Welcome back</h2><p>Here&apos;s what&apos;s happening with your team today.</p></div><div className="welcome-date"><CalendarDays size={17} />{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>
    <div className="metric-grid dashboard-metrics">
      <Metric label="Active employees" value={activeEmployees.length} note={`${state.companies.length} companies`} icon={Users} onClick={() => go('employees')} />
      <Metric label="Attendance marked" value={`${marked} / ${activeEmployees.length}`} note="Tap to mark attendance" icon={Clock3} tone="green" onClick={markAttendance} />
      <Metric label="Working now" value={working} note={`${breaks} currently on break`} icon={Coffee} tone="blue" onClick={() => go('attendance')} />
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

function AttendancePage({ state, employees, selected, selectEmployee, session, todaySession, correction, workMs, workHours, now }) {
  const [status, setStatus] = useState('Present');
  const [note, setNote] = useState('');
  const [overtime, setOvertime] = useState('1');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const requests = state.overtimeRequests.filter((item) => item.date === todayKey() && employees.some((employee) => employee.id === item.employeeId));
  if (!selected) return <div className="empty-state large"><Users size={30} /><strong>No active employees</strong><p>Add an employee before tracking attendance.</p></div>;
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
    await state.markAttendance(selected.id, todayKey(), statusValue, note.trim());
    setNote('');
  }
  function requestOvertime() {
    const hours = Number(overtime);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return window.alert('Enter overtime between 0.5 and 24 hours.');
    if (state.overtimeRequests.some((item) => item.employeeId === selected.id && item.date === todayKey() && item.status === 'pending')) return window.alert('This employee already has a pending request today.');
    state.requestOvertime(selected.id, hours);
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
    <div className="attendance-detail-heading"><div><p className="eyebrow">EMPLOYEE ATTENDANCE</p><h2>Manage {selected.name}</h2></div><span className="muted">Shift {selected.shiftStart}–{selected.shiftEnd}</span></div>
    <div className="attendance-detail-layout">
      <Card className="attendance-main"><div className="employee-inline"><Avatar employee={selected} size="large" /><div><h2>{selected.name}</h2><p>{selected.code} · {selected.designation}</p></div><span className={`status-tag ${(correction?.status ?? session?.status ?? todaySession?.status ?? 'not-started').toLowerCase().replace(/\s+/g, '-')}`}>{correction?.status ?? (session?.status === 'clocked-out' ? 'Completed' : session?.status === 'break' ? 'On break' : session?.status === 'working' ? 'Working' : todaySession?.status ?? 'Not started')}</span></div>
        <div className="timer-panel"><span>WORK TIME TODAY</span><strong>{formatDuration(workMs)}</strong><p>{workHours.toFixed(2)} hours logged · {Math.max(0, selected.requiredHours - workHours).toFixed(2)} hours remaining</p><div className="progress-track"><span style={{ width: `${Math.min(100, workHours / selected.requiredHours * 100)}%` }} /></div><small>Required shift: {selected.requiredHours} hours · Approved overtime: {approved} hours</small></div>
        <div className="clock-actions"><Button disabled={!!todaySession} onClick={() => state.clockIn(selected.id)}><LogIn size={16} /> Clock in</Button><Button variant="secondary" disabled={session?.status !== 'working'} onClick={() => state.startBreak(selected.id)}><Coffee size={16} /> Start break</Button><Button variant="success" disabled={session?.status !== 'break'} onClick={() => state.resumeWork(selected.id)}><Clock3 size={16} /> Resume work</Button><Button variant="outline" disabled={!session} onClick={() => state.clockOut(selected.id)}><LogOut size={16} /> Clock out</Button></div>
        <div className="correction-panel"><h3>Manual attendance correction</h3><p>Overrides automatic attendance status for today.</p><div className="inline-form"><select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>{attendanceStatuses.map((item) => <option key={item}>{item}</option>)}</select><input className="text-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (optional)" /><Button variant="secondary" onClick={() => mark(status)}>Save status</Button></div>{correction && <p className="audit-note">Current override: <strong>{correction.status}</strong>{correction.note ? ` · ${correction.note}` : ''}</p>}</div>
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
  return <div className="settings-grid"><Card><div className="profile-summary"><Avatar employee={admin} size="large" /><div><h2>{admin?.name ?? 'Workspace admin'}</h2><p>{admin?.designation ?? 'Administrator'} · {company?.name}</p></div></div><div className="setting-row"><div className="setting-icon"><Sun size={18} /></div><div><strong>Dark appearance</strong><span>Switch the dashboard theme</span></div><button className={`toggle ${state.theme === 'dark' ? 'on' : ''}`} onClick={() => state.setTheme(state.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode"><i /></button></div><div className="setting-row"><div className="setting-icon amber"><Clock3 size={18} /></div><div><strong>Attendance reminders</strong><span>Browser notifications are not configured in this web app.</span></div><span className="muted">Unavailable</span></div></Card><Card><div className="section-heading"><div><h2>Workspace</h2><p>Manage your HR workspace data.</p></div></div><button className="settings-link" onClick={() => setPage('companies')}><Building2 size={18} /><span><strong>Manage companies</strong><small>{state.companies.length} companies · switch or edit</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={() => admin && setPage('employees')}><Users size={18} /><span><strong>Employee directory</strong><small>Personal details, salary and shift settings</small></span><ArrowRight size={16} /></button><button className="settings-link" onClick={exportAttendance}><Download size={18} /><span><strong>Export attendance CSV</strong><small>Download this company&apos;s attendance history</small></span><ArrowRight size={16} /></button><div className="storage-note">Your HRMS data is stored locally in this browser.</div></Card></div>;
}

function QuickAttendanceModal({ employees, onClose, onSave }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [status, setStatus] = useState('Present');
  const [note, setNote] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!employeeId) return;
    onSave({ employeeId, status, note: note.trim() });
  }

  return <Modal title="Mark attendance" onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      {employees.length ? <>
        <p className="modal-copy">Record today&apos;s attendance without leaving the dashboard.</p>
        <label className="field"><span>Employee</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}</select></label>
        <label className="field"><span>Attendance status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{attendanceStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Field label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a reason or note" />
        <p className="attendance-modal-date"><CalendarDays size={15} />{new Date(`${todayKey()}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
        if (days > 0 && monthly >= 0) next.perDaySalary = (monthly / days).toFixed(2);
      }
      return next;
    });
  }
  function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.designation.trim() || !form.department.trim()) return window.alert('Name, employee ID, designation and department are required.');
    onSave(form);
  }
  return <Modal title={employee ? 'Edit employee' : 'Add employee'} onClose={onClose} wide><form className="modal-form" onSubmit={submit}><div className="form-section"><h3>Personal information</h3><div className="form-grid"><Field label="Full name" value={form.name} onChange={(event) => change('name', event.target.value)} required /><Field label="Employee ID" value={form.code} onChange={(event) => change('code', event.target.value)} required /><Field label="Email" type="email" value={form.email} onChange={(event) => change('email', event.target.value)} /><Field label="Phone" value={form.phone} onChange={(event) => change('phone', event.target.value)} /><Field label="Designation" value={form.designation} onChange={(event) => change('designation', event.target.value)} required /><Field label="Department" value={form.department} onChange={(event) => change('department', event.target.value)} required /></div></div><div className="form-section"><h3>Shift and attendance</h3><div className="form-grid"><Field label="Working days per month" type="number" min="1" max="31" value={form.workingDaysPerMonth} onChange={(event) => change('workingDaysPerMonth', event.target.value)} required /><Field label="Required hours per day" type="number" min="1" max="24" step="0.5" value={form.requiredHours} onChange={(event) => change('requiredHours', event.target.value)} /><Field label="Full-day threshold (hours)" type="number" min="1" max="24" step="0.5" value={form.fullDayHours} onChange={(event) => change('fullDayHours', event.target.value)} /><Field label="Half-day threshold (hours)" type="number" min="0" max="24" step="0.5" value={form.halfDayHours} onChange={(event) => change('halfDayHours', event.target.value)} /><Field label="Shift starts" type="time" value={form.shiftStart} onChange={(event) => change('shiftStart', event.target.value)} /><Field label="Shift ends" type="time" value={form.shiftEnd} onChange={(event) => change('shiftEnd', event.target.value)} /></div></div><div className="form-section"><h3>Salary settings</h3><div className="form-grid"><Field label="Monthly salary (₹)" type="number" min="0" value={form.monthlySalary} onChange={(event) => change('monthlySalary', event.target.value)} required /><Field label="Per-day salary (₹)" type="number" min="0" step="0.01" value={form.perDaySalary} onChange={(event) => change('perDaySalary', event.target.value)} required /><Field label="Overtime rate / hour (₹)" type="number" min="0" value={form.overtimeRate} onChange={(event) => change('overtimeRate', event.target.value)} /><Field label="Monthly allowances (₹)" type="number" min="0" value={form.allowances} onChange={(event) => change('allowances', event.target.value)} /><Field label="Monthly deductions (₹)" type="number" min="0" value={form.deductions} onChange={(event) => change('deductions', event.target.value)} /></div><p className="form-hint">Per-day salary recalculates when monthly salary or working days change. Edit it separately for a custom rate.</p></div><footer className="modal-actions">{employee && <Button type="button" variant="danger" onClick={() => { onDelete(employee); onClose(); }}>Delete employee</Button>}<span /><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><Check size={15} /> Save employee</Button></footer></form></Modal>;
}

function CompanyModal({ company, onClose, onSave }) {
  const [form, setForm] = useState({
    id: company?.id ?? '', name: company?.name ?? '', address: company?.address ?? '', email: company?.email ?? '', phone: company?.phone ?? '', registration: company?.registration ?? '', color: company?.color ?? colors[0],
  });
  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  return <Modal title={company ? 'Edit company' : 'Add company'} onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim()) return window.alert('Company name is required.'); onSave(form); }}><Field label="Company name" value={form.name} onChange={(event) => change('name', event.target.value)} required /><Field label="Address" value={form.address} onChange={(event) => change('address', event.target.value)} /><Field label="Email" type="email" value={form.email} onChange={(event) => change('email', event.target.value)} /><Field label="Phone" value={form.phone} onChange={(event) => change('phone', event.target.value)} /><Field label="Registration details" value={form.registration} onChange={(event) => change('registration', event.target.value)} /><div className="field"><span>Brand color</span><div className="color-options">{colors.map((color) => <button type="button" key={color} className={form.color === color ? 'chosen' : ''} style={{ background: color }} onClick={() => change('color', color)} aria-label={`Select ${color}`} />)}</div></div><footer className="modal-actions"><span /><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><Check size={15} /> Save company</Button></footer></form></Modal>;
}

export default App;
