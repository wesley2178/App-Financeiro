/**
 * Safe calendar date utilities for Brazil (America/Sao_Paulo), leap years, and 28/29/30/31-day months.
 * All date strings use canonical YYYY-MM-DD local calendar dates.
 */

export function getTodayISO(referenceNow?: Date): string {
  const now = referenceNow ?? new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to local Date if Intl timeZone is unavailable
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [yStr, mStr, dStr] = iso.split('-');
  return {
    year: Number.parseInt(yStr, 10) || 2026,
    month: Number.parseInt(mStr, 10) || 1,
    day: Number.parseInt(dStr, 10) || 1,
  };
}

export function toISODate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const idx = ((month - 1) % 12 + 12) % 12;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[idx];
}

/**
 * Formats YYYY-MM-DD as dd/mm/aaaa
 */
export function formatDateBR(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const { year, month, day } = parseISODate(iso);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function formatShortDateBR(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const { month, day } = parseISODate(iso);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

export function formatMonthYearBR(year: number, month: number): string {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${months[(month - 1) % 12]} de ${year}`;
}

export function addDaysISO(iso: string, days: number): string {
  const { year, month, day } = parseISODate(iso);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Safely adds months clamping day to last day of target month (e.g., Jan 31 + 1 month -> Feb 28/29).
 */
export function addMonthsSafeISO(iso: string, monthsToAdd: number): string {
  const { year, month, day } = parseISODate(iso);
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  const maxDay = daysInMonth(newYear, newMonth);
  return toISODate(newYear, newMonth, Math.min(day, maxDay));
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

export function getDayOfWeekISO(iso: string): number {
  const { year, month, day } = parseISODate(iso);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Dom..6=Sab
}

export const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_NAMES_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Returns next date >= refISO matching targetDayOfMonth (clamped to month length).
 */
export function getNextDueDateForDay(targetDayOfMonth: number, refISO: string): string {
  const { year, month, day } = parseISODate(refISO);
  const curMonthMax = daysInMonth(year, month);
  const clampedCur = Math.min(Math.max(1, targetDayOfMonth), curMonthMax);
  if (clampedCur >= day) {
    return toISODate(year, month, clampedCur);
  }
  const nextMonthFirst = addMonthsSafeISO(toISODate(year, month, 1), 1);
  const nextParsed = parseISODate(nextMonthFirst);
  const nextMax = daysInMonth(nextParsed.year, nextParsed.month);
  return toISODate(nextParsed.year, nextParsed.month, Math.min(Math.max(1, targetDayOfMonth), nextMax));
}

export function getGreetingPTBR(now?: Date): string {
  const dt = now ?? new Date();
  let hour = dt.getHours();
  try {
    const hStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(dt);
    const parsed = Number.parseInt(hStr, 10);
    if (!Number.isNaN(parsed)) hour = parsed;
  } catch {
    // ignore
  }
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function getMonthPrefix(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function getWeekStartEnd(refISO: string): { start: string; end: string } {
  const dow = getDayOfWeekISO(refISO); // 0=Dom..6=Sab
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = addDaysISO(refISO, mondayOffset);
  const end = addDaysISO(start, 6);
  return { start, end };
}
