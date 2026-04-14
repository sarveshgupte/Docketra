const splitCsvLine = (line, delimiter) => {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
};

const detectDelimiter = (headerLine) => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
};

const parse = (content, options = {}) => {
  const { header = false, skipEmptyLines = false, transformHeader } = options;
  const text = String(content || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => (skipEmptyLines ? line.trim() : true));

  if (!lines.length) {
    return { data: [], errors: [], meta: { fields: [] } };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const fields = rawHeaders.map((headerValue) => (
    typeof transformHeader === 'function' ? transformHeader(headerValue) : headerValue
  ));

  const dataRows = lines.slice(1).map((line) => splitCsvLine(line, delimiter));

  if (!header) {
    return {
      data: [fields, ...dataRows],
      errors: [],
      meta: { fields: [] },
    };
  }

  const data = dataRows.map((values) => fields.reduce((acc, field, index) => ({
    ...acc,
    [field]: values[index] || '',
  }), {}));

  return {
    data,
    errors: [],
    meta: { fields },
  };
};

export default {
  parse,
};
