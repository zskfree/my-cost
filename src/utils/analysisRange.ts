import type { AnalysisPreset, AnalysisRange } from '../types';

export function currentDateString(date = new Date()): string {
  return formatDate(date);
}

export function currentMonthString(date = new Date()): string {
  return formatMonth(date);
}

export function previousAnalysisRange(range: AnalysisRange): AnalysisRange {
  const from = parseDate(range.from);
  const to = parseDate(range.to);
  if (!from || !to || from > to) return range;
  const length = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const previousTo = new Date(from);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - length + 1);
  return { preset: range.preset, from: formatDate(previousFrom), to: formatDate(previousTo), label: '上一周期' };
}

export function makeAnalysisRange(preset: AnalysisPreset, anchor = new Date(), customFrom?: string, customTo?: string): AnalysisRange {
  const today = startOfDay(anchor);
  const todayText = formatDate(today);

  if (preset === 'custom') {
    const from = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : todayText;
    const to = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : from;
    return { preset, from: from <= to ? from : to, to: from <= to ? to : from, label: `${from <= to ? from : to} 至 ${from <= to ? to : from}` };
  }

  if (preset === 'day') return { preset, from: todayText, to: todayText, label: `今天 · ${todayText}` };
  if (preset === '7d') return rangeFromDays(preset, today, 7, '最近 7 天');
  if (preset === '30d') return rangeFromDays(preset, today, 30, '最近 30 天');

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  if (preset === 'month') return rangeFromMonth(preset, monthStart, 1, '本月');
  if (preset === '3m') return rangeFromMonth(preset, monthStart, 3, '最近 3 个月');
  if (preset === '12m') return rangeFromMonth(preset, monthStart, 12, '最近 12 个月');
  if (preset === '3y') {
    const from = new Date(today.getFullYear() - 2, 0, 1);
    const to = new Date(today.getFullYear(), 11, 31);
    return { preset, from: formatDate(from), to: formatDate(to), label: '最近 3 年' };
  }

  const from = new Date(today.getFullYear(), 0, 1);
  const to = new Date(today.getFullYear(), 11, 31);
  return { preset: 'year', from: formatDate(from), to: formatDate(to), label: `今年 · ${today.getFullYear()}` };
}

function rangeFromDays(preset: AnalysisPreset, today: Date, days: number, label: string): AnalysisRange {
  const from = new Date(today);
  from.setDate(from.getDate() - days + 1);
  return { preset, from: formatDate(from), to: formatDate(today), label };
}

function rangeFromMonth(preset: AnalysisPreset, monthStart: Date, months: number, label: string): AnalysisRange {
  const from = new Date(monthStart.getFullYear(), monthStart.getMonth() - months + 1, 1);
  const to = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  return { preset, from: formatDate(from), to: formatDate(to), label };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}
