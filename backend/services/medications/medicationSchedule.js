import { randomUUID } from 'node:crypto';

const dateFormatterCache = new Map();

function getDateFormatter(timeZone) {
  if (!dateFormatterCache.has(timeZone)) {
    dateFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
    );
  }

  return dateFormatterCache.get(timeZone);
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function parseDateString(dateString) {
  const [year, month, day] = String(dateString)
    .split('-')
    .map((value) => Number(value));

  return { year, month, day };
}

function parseTimeString(timeString) {
  const [hour, minute] = String(timeString)
    .split(':')
    .map((value) => Number(value));

  return { hour, minute };
}

function buildIsoDateString(year, month, day) {
  return `${String(year).padStart(4, '0')}-${padNumber(month)}-${padNumber(day)}`;
}

export function getServerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function resolveMedicationTimeZone(timeZone) {
  if (!timeZone) {
    return getServerTimeZone();
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return getServerTimeZone();
  }
}

export function getZonedDateTimeParts(date, timeZone) {
  const parts = getDateFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

export function getLocalDateString(date, timeZone) {
  const parts = getZonedDateTimeParts(date, timeZone);
  return buildIsoDateString(parts.year, parts.month, parts.day);
}

export function addDaysToDateString(dateString, days) {
  const { year, month, day } = parseDateString(dateString);
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  baseDate.setUTCDate(baseDate.getUTCDate() + days);

  return buildIsoDateString(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth() + 1,
    baseDate.getUTCDate()
  );
}

export function compareDateStrings(left, right) {
  return left.localeCompare(right);
}

export function sortMedicationTimes(times) {
  return Array.from(new Set(times)).sort((left, right) => left.localeCompare(right));
}

export function deriveFrequencyLabel(timesCount) {
  if (timesCount <= 1) {
    return 'once daily';
  }

  if (timesCount === 2) {
    return 'twice daily';
  }

  return `${timesCount} times daily`;
}

export function zonedDateTimeToUtc(dateString, timeString, timeZone) {
  const { year, month, day } = parseDateString(dateString);
  const { hour, minute } = parseTimeString(timeString);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(targetWallTime);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = getZonedDateTimeParts(guess, timeZone);
    const currentWallTime = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
      0
    );
    const diff = targetWallTime - currentWallTime;

    if (diff === 0) {
      return guess;
    }

    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

export function isMedicationActive(record, now = new Date()) {
  const currentLocalDate = getLocalDateString(now, record.timezone);
  return compareDateStrings(currentLocalDate, record.startsOn) >= 0
    && compareDateStrings(currentLocalDate, record.endsOn) <= 0;
}

export function getDueOccurrences(record, now = new Date(), dueWindowMinutes = 30) {
  const dueWindowMs = dueWindowMinutes * 60 * 1000;
  const candidateDates = Array.from(
    new Set([
      getLocalDateString(now, record.timezone),
      getLocalDateString(new Date(now.getTime() - dueWindowMs), record.timezone),
    ])
  ).sort((left, right) => left.localeCompare(right));

  const occurrences = [];

  for (const localDate of candidateDates) {
    if (compareDateStrings(localDate, record.startsOn) < 0 || compareDateStrings(localDate, record.endsOn) > 0) {
      continue;
    }

    for (const time of record.times) {
      const dueAt = zonedDateTimeToUtc(localDate, time, record.timezone);
      const dueAtMs = dueAt.getTime();

      if (dueAtMs <= now.getTime() && dueAtMs + dueWindowMs > now.getTime()) {
        occurrences.push({
          occurrenceKey: `${localDate}@${time}`,
          dueAt: dueAt.toISOString(),
          localDate,
          time,
        });
      }
    }
  }

  return occurrences.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function computeNextDueAt(record, now = new Date()) {
  const currentLocalDate = getLocalDateString(now, record.timezone);
  let scanDate =
    compareDateStrings(currentLocalDate, record.startsOn) > 0 ? currentLocalDate : record.startsOn;

  while (compareDateStrings(scanDate, record.endsOn) <= 0) {
    for (const time of record.times) {
      const dueAt = zonedDateTimeToUtc(scanDate, time, record.timezone);

      if (dueAt.getTime() >= now.getTime()) {
        return dueAt.toISOString();
      }
    }

    scanDate = addDaysToDateString(scanDate, 1);
  }

  return null;
}

export function buildMedicationResponse(record, now = new Date()) {
  return {
    id: record.id,
    name: record.name,
    dosage: record.dosage,
    frequency: record.frequency,
    times: [...record.times],
    durationDays: record.durationDays,
    timezone: record.timezone,
    createdAt: record.createdAt,
    startsOn: record.startsOn,
    endsOn: record.endsOn,
    nextDueAt: computeNextDueAt(record, now),
  };
}

export function createMedicationRecord(payload, ownerId, createdAt = new Date()) {
  const normalizedCreatedAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const timezone = resolveMedicationTimeZone(payload.timezone);
  const times = sortMedicationTimes(payload.times);
  const startsOn = getLocalDateString(normalizedCreatedAt, timezone);
  const endsOn = addDaysToDateString(startsOn, Number(payload.durationDays) - 1);

  return {
    id: randomUUID(),
    ownerId,
    name: payload.name,
    dosage: payload.dosage,
    frequency: deriveFrequencyLabel(times.length),
    times,
    durationDays: Number(payload.durationDays),
    timezone,
    createdAt: normalizedCreatedAt.toISOString(),
    startsOn,
    endsOn,
    reminders: [],
  };
}
