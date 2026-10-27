const numberFormatter = new Intl.NumberFormat('en-US');

export const formatNumber = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : numberFormatter.format(value);

export const formatDecimal = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits);

/** 91.743 → 1:31.743 */
export const formatLapTime = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const secondsText = rest.toFixed(3).padStart(6, '0');
  return minutes > 0 ? `${minutes}:${secondsText}` : rest.toFixed(3);
};

/** 1:31.743 → milliseconds, used by OpenF1 telemetry charts. */
export const toMilliseconds = (seconds: number | null | undefined): number | null =>
  seconds === null || seconds === undefined || !Number.isFinite(seconds) ? null : Math.round(seconds * 1000);

export const ordinal = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

export const initials = (forename?: string | null, surname?: string | null): string => {
  const first = forename?.trim()?.[0] ?? '';
  const last = surname?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
};

export const surnameOf = (name: string): string => name.trim().split(/\s+/).pop() ?? name;

export const shortDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const longDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};

export const countdownTo = (target: string | null | undefined): string => {
  if (!target) return '—';
  const diff = new Date(target).getTime() - Date.now();
  if (Number.isNaN(diff)) return '—';
  if (diff <= 0) return 'Underway';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

/** Deterministic, pleasant accent colour for entities without a brand colour. */
export const colorFromId = (seed: number | string): string => {
  const text = String(seed);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 72%, 58%)`;
};

export const hexAlpha = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
