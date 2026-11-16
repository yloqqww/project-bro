export function zonedDateKey(date: Date, timezone = 'Asia/Manila') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function zonedDayBounds(dateKey: string, timezone = 'Asia/Manila') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const probe = new Date(`${dateKey}T12:00:00Z`);
  const offsetName = formatter.formatToParts(probe).find((part) => part.type === 'timeZoneName')?.value || 'GMT+08:00';
  const offset = offsetName.replace('GMT', '') || '+00:00';
  return {
    start: new Date(`${dateKey}T00:00:00${offset}`),
    end: new Date(`${dateKey}T23:59:59.999${offset}`),
  };
}

export function reportRange(searchParams: URLSearchParams, timezone = 'Asia/Manila') {
  const today = zonedDateKey(new Date(), timezone);
  const fromKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') || '') ? searchParams.get('from')! : today;
  const toKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') || '') ? searchParams.get('to')! : fromKey;
  const from = zonedDayBounds(fromKey, timezone).start;
  const to = zonedDayBounds(toKey, timezone).end;
  if (from > to) throw new Error('The report start date must not be after the end date.');
  return { fromKey, toKey, from, to, timezone };
}
