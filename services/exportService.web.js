function download(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function quoteCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export async function exportCsv(filename, rows) {
  const content = rows.map((row) => row.map(quoteCsv).join(',')).join('\n');
  download(`${filename}.csv`, content, 'text/csv;charset=utf-8');
}

