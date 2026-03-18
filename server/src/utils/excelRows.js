import XLSX from 'xlsx'

/**
 * First worksheet → array of plain objects (header row = keys).
 * Values stringified for consistent CSV-style mapping.
 */
export function excelBufferToRowRecords(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  if (!wb.SheetNames?.length) return []
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  return rows.map((r) => {
    const o = {}
    for (const [k, v] of Object.entries(r)) {
      if (k == null) continue
      const key = String(k).trim()
      if (!key) continue
      o[key] = v == null || v === '' ? '' : String(v)
    }
    return o
  })
}

export function isExcelExtension(ext) {
  const e = String(ext || '').toLowerCase()
  return e === '.xlsx' || e === '.xls'
}
