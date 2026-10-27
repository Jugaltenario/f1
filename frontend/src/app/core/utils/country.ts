/** Country names used by the Ergast archive → emoji flags (no network needed). */
const FLAGS: Record<string, string> = {
  argentina: '🇦🇷',
  australia: '🇦🇺',
  austria: '🇦🇹',
  azerbaijan: '🇦🇿',
  bahrain: '🇧🇭',
  belgium: '🇧🇪',
  brazil: '🇧🇷',
  canada: '🇨🇦',
  china: '🇨🇳',
  'czech republic': '🇨🇿',
  denmark: '🇩🇰',
  finland: '🇫🇮',
  france: '🇫🇷',
  germany: '🇩🇪',
  hungary: '🇭🇺',
  india: '🇮🇳',
  ireland: '🇮🇪',
  italy: '🇮🇹',
  japan: '🇯🇵',
  'korea': '🇰🇷',
  'south korea': '🇰🇷',
  liechtenstein: '🇱🇮',
  malaysia: '🇲🇾',
  mexico: '🇲🇽',
  monaco: '🇲🇨',
  netherlands: '🇳🇱',
  'new zealand': '🇳🇿',
  poland: '🇵🇱',
  portugal: '🇵🇹',
  qatar: '🇶🇦',
  russia: '🇷🇺',
  'saudi arabia': '🇸🇦',
  singapore: '🇸🇬',
  'south africa': '🇿🇦',
  spain: '🇪🇸',
  sweden: '🇸🇪',
  switzerland: '🇨🇭',
  turkey: '🇹🇷',
  uae: '🇦🇪',
  'united arab emirates': '🇦🇪',
  uk: '🇬🇧',
  'united kingdom': '🇬🇧',
  usa: '🇺🇸',
  'united states': '🇺🇸',
  'united states of america': '🇺🇸',
  vietnam: '🇻🇳',
};

export const countryFlag = (country: string | null | undefined): string =>
  FLAGS[(country ?? '').trim().toLowerCase()] ?? '🏁';

export const countryName = (country: string | null | undefined): string => (country ?? '').trim() || '—';

/** Two letter code used as a compact label when a flag is unavailable. */
export const countryCode = (country: string | null | undefined): string => {
  const name = (country ?? '').trim();
  if (!name) return '—';
  const special: Record<string, string> = {
    uk: 'UK',
    'united kingdom': 'UK',
    usa: 'US',
    'united states': 'US',
    uae: 'AE',
    'south korea': 'KR',
  };
  const key = name.toLowerCase();
  return special[key] ?? name.slice(0, 2).toUpperCase();
};
