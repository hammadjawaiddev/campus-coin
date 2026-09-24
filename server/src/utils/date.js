/** All month maths in the API is done in UTC to keep aggregations stable. */

const startOfMonthUTC = (date = new Date()) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
};

const endOfMonthUTC = (date = new Date()) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
};

const startOfDayUTC = (date = new Date()) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const endOfDayUTC = (date = new Date()) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
};

const addMonthsUTC = (date, months) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
};

const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86400000);

const monthKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (date) =>
  new Date(date).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const shortMonthLabel = (date) =>
  new Date(date).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

const dayLabel = (date) =>
  new Date(date).toLocaleString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/** Inclusive list of month-start dates ending at `end` (which itself included). */
const lastMonths = (count, end = new Date()) => {
  const endMonth = startOfMonthUTC(end);
  return Array.from({ length: count }, (_, i) => addMonthsUTC(endMonth, -(count - 1 - i)));
};

const daysBetween = (a, b) => Math.round((startOfDayUTC(b) - startOfDayUTC(a)) / 86400000);

const isSameMonthUTC = (a, b) => monthKey(a) === monthKey(b);

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd);

/** Advance a date by one recurring period (used by the recurring scheduler). */
const nextOccurrenceFrom = (date, frequency) => {
  const d = new Date(date);
  switch (frequency) {
    case 'daily':
      return addDays(d, 1);
    case 'weekly':
      return addDays(d, 7);
    case 'yearly':
      return new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));
    case 'monthly':
    default:
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));
  }
};

module.exports = {
  startOfMonthUTC,
  endOfMonthUTC,
  startOfDayUTC,
  endOfDayUTC,
  addMonthsUTC,
  addDays,
  monthKey,
  monthLabel,
  shortMonthLabel,
  dayLabel,
  lastMonths,
  daysBetween,
  isSameMonthUTC,
  rangesOverlap,
  nextOccurrenceFrom,
};
