/**
 * Tiny CSV helpers shared by the archive scripts.
 *
 * The tables are Ergast-style: mostly plain ASCII, but team and circuit names
 * can contain commas and accented characters, so we need a real parser rather
 * than split(',').
 */

/** Parse CSV text into `{ header, rows }` where each row is a plain object. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return {
    header,
    rows: body
      .filter((cells) => cells.length === header.length)
      .map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i]]))),
  };
}

/** Serialise a header + object rows back to CSV text with a trailing newline. */
export function toCsv(header, rows) {
  const escape = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    if (/[",\n\r]/.test(text) || /^\s|\s$/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [header.join(','), ...rows.map((row) => header.map((key) => escape(row[key])).join(','))].join('\n') + '\n';
}

export const num = (value) =>
  value === '' || value === undefined || value === null || value === '\\N' ? null : Number(value);

export const int = (value, fallback = 0) => {
  const parsed = num(value);
  return parsed === null || Number.isNaN(parsed) ? fallback : parsed;
};

/** Ergast writes missing values as the literal `\N`. */
export const str = (value, fallback = '') =>
  value === undefined || value === null || value === '\\N' ? fallback : String(value);
