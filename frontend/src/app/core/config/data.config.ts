/**
 * Central place for data-scope decisions.
 *
 * The bundled archive covers 2000 to the current season. It is assembled by
 * `npm run data:build`, which prunes the Ergast dump and then appends the
 * current seasons from Jolpica, so `endYear` is always whatever the last sync
 * produced. The constants below are fallbacks for the window before meta.json
 * arrives and for copy that has no access to the archive.
 */
export const DATA_START_YEAR = 2000;

/** Last season present in the bundle. The live value comes from `meta.endYear`. */
export const ARCHIVE_END_YEAR = 2026;

/** Date the archive was last reconciled with the live season. */
export const DATA_THROUGH = '2026-10-26';

/** OpenF1 (and therefore live timing / telemetry) starts here. */
export const OPENF1_START_YEAR = 2023;

export const CURRENT_YEAR = new Date().getFullYear();

/** Every season the UI offers, newest first. */
export const AVAILABLE_YEARS: number[] = Array.from(
  { length: ARCHIVE_END_YEAR - DATA_START_YEAR + 1 },
  (_, i) => ARCHIVE_END_YEAR - i,
);

export const isOpenF1Year = (year: number): boolean => year >= OPENF1_START_YEAR;

export const isArchiveYear = (year: number): boolean =>
  year >= DATA_START_YEAR && year <= ARCHIVE_END_YEAR;

/**
 * Team colours are used for 3px data bars and badges only — never as a
 * background wash. Kept close to the real liveries so the bars read correctly
 * next to the logos.
 */
export const TEAM_COLORS: Record<string, string> = {
  ferrari: '#e8002d',
  red_bull: '#3671c6',
  mercedes: '#00a19c',
  mclaren: '#ff8000',
  alpine: '#0090ff',
  aston_martin: '#229971',
  williams: '#1868db',
  rb: '#6692ff',
  racing_bulls: '#6692ff',
  sauber: '#52e252',
  audi: '#f50537',
  haas: '#9c9fa2',
  cadillac: '#b8a06a',
  toyota: '#cc0000',
  honda: '#cc0000',
  bmw_sauber: '#29376b',
  brawn: '#b8ff00',
  force_india: '#f596c8',
  racing_point: '#f596c8',
  renault: '#fff500',
  lotus_f1: '#ffb800',
  caterham: '#0b8c3d',
  marussia: '#6e0000',
  virgin: '#e4002b',
  hrt: '#b2945e',
  jaguar: '#0b6e4f',
  bar: '#ffffff',
  jordan: '#f5c518',
  minardi: '#1b3d2f',
  prost: '#1f3a93',
  arrows: '#ff8c00',
  benetton: '#00a650',
  stewart: '#ffffff',
  tyrrell: '#1e4d8c',
};

export const teamColor = (ref: string | undefined | null): string => {
  if (!ref) return '#8b8f98';
  return TEAM_COLORS[ref] ?? '#8b8f98';
};
