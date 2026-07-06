/**
 * Escapes a single cell value for a CSV row according to RFC 4180.
 * If the value is null/undefined, returns an empty string.
 * Encloses the value in double quotes if it contains a comma, double quote, or newlines.
 * Escapes any double quotes inside by doubling them.
 */
export function escapeCSVField(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes headers and data rows into a single UTF-8 BOM-prefixed CSV string.
 * Rows are joined with standard CRLF (\r\n).
 */
export function serializeToCSV(headers, rows) {
  const headerRow = headers.map(escapeCSVField).join(',');
  const dataRows = rows.map(row => row.map(escapeCSVField).join(','));
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n') + '\r\n';
}
