// Calendar helpers. Days are local "YYYY-MM-DD" strings, so that a streak follows the learner's
// own midnight rather than UTC.

const pad = (value: number) => String(value).padStart(2, '0')

/** Local calendar day of `date`, e.g. "2026-10-21". */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Shifts a "YYYY-MM-DD" day by `days` (negative to go back); immune to DST changes. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** First instant of the local day after `date`. */
export function startOfNextDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
}

/** Whole days from one "YYYY-MM-DD" day to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const toUtc = (day: string) => {
    const [year, month, date] = day.split('-').map(Number)
    return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1)
  }
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000)
}
