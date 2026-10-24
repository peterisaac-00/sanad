import { ApiError } from "../errors.js";

/** RFC 4180 CSV helpers with spreadsheet formula-injection protection. */

export const CSV_BOM = "\uFEFF";

/** Cap exports before any bytes are streamed so a 413 can still be JSON. */
export function assertExportWithinLimit(count: number, maxRows: number): void {
  if (count > maxRows) {
    throw new ApiError(
      413,
      "EXPORT_TOO_LARGE",
      `This export contains ${count.toLocaleString("en-US")} rows; the limit is ${maxRows.toLocaleString("en-US")}. Narrow the filters and try again.`,
      { rows: count, limit: maxRows }
    );
  }
}

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Excel/Sheets execute cells beginning with these characters. Prefixing a
  // single quote keeps the human-readable value while neutralising formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export function csvHeader(columns: string[]): string {
  return columns.map(csvCell).join(",");
}
