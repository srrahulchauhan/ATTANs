export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

export function sessionWorkMilliseconds(session, now = Date.now()) {
  if (!session) return 0;
  const activeMilliseconds = session.status === 'working' && session.activeWorkStartedAt
    ? Math.max(0, now - session.activeWorkStartedAt)
    : 0;
  return session.workMs + activeMilliseconds;
}

export function sessionBreakMilliseconds(session, now = Date.now()) {
  if (!session) return 0;
  return session.breaks.reduce((total, item) => {
    const end = item.endAt ?? (session.status === 'break' ? now : item.startAt);
    return total + Math.max(0, end - item.startAt);
  }, 0);
}

export function addHoursToTime(time, hours) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute + Math.round(hours * 60), 0, 0);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
