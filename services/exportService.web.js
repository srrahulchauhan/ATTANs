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

export async function exportXlsx(filename, sheetName, rows) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName.slice(0, 31));
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  download(`${filename}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
