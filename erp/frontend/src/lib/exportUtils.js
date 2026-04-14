import * as XLSX from 'xlsx';

/**
 * Export data as CSV file download
 * @param {Array<Object>} data - Array of objects
 * @param {string} filename - Filename without extension
 * @param {Array<{key: string, label: string}>} columns - Column definitions
 */
export function exportCSV(data, filename, columns) {
  if (!data?.length) return;

  const headers = columns.map(c => c.label);
  const rows = data.map(row => columns.map(c => {
    const val = row[c.key];
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return val;
    return String(val);
  }));

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data as Excel (.xlsx) file download
 * @param {Array<Object>} data - Array of objects
 * @param {string} filename - Filename without extension
 * @param {Array<{key: string, label: string}>} columns - Column definitions
 * @param {string} sheetName - Sheet name (default: 'Datos')
 */
export function exportExcel(data, filename, columns, sheetName = 'Datos') {
  if (!data?.length) return;

  const headers = columns.map(c => c.label);
  const rows = data.map(row => columns.map(c => row[c.key] ?? ''));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-width columns
  ws['!cols'] = columns.map((c, i) => {
    const maxLen = Math.max(
      c.label.length,
      ...rows.map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
