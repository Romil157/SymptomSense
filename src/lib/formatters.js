export function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export function humanizeSex(value) {
  return String(value || '').replace(/_/g, ' ');
}

export function formatList(items) {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

export function formatDateTime(value) {
  if (!value) {
    return 'Not scheduled';
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatCalendarDate(value) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
