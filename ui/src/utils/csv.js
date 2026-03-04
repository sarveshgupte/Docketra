export const escapeCsvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const buildCsv = (rows = []) => rows.map((line) => line.map(escapeCsvCell).join(',')).join('\n');

