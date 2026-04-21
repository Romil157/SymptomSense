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
