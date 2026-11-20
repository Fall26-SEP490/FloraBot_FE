// Minimal OOXML workbook: typed text cells preserve IDs and never execute CSV formulas.
const xml = (value: string) =>
  value
    .split('')
    .filter((char) => char.charCodeAt(0) >= 32 || '\t\n\r'.includes(char))
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\r' || char === '\n')) {
      row.push(cell);
      cell = '';
      if (char !== ',') {
        rows.push(row);
        row = [];
        if (char === '\r' && source[i + 1] === '\n') i++;
      }
    } else cell += char;
  }
  if (quoted) throw new Error('Dữ liệu CSV chưa hoàn chỉnh. Vui lòng tải lại.');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP stored entries avoid adding a runtime dependency for a single-sheet export.
function zip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, content]) => ({
    name: encoder.encode(name),
    data: encoder.encode(content),
  }));
  const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let local = 0,
    central = localSize;
  for (const e of entries) {
    const crc = crc32(e.data);
    view.setUint32(local, 0x04034b50, true);
    view.setUint16(local + 4, 20, true);
    view.setUint32(local + 14, crc, true);
    view.setUint32(local + 18, e.data.length, true);
    view.setUint32(local + 22, e.data.length, true);
    view.setUint16(local + 26, e.name.length, true);
    output.set(e.name, local + 30);
    output.set(e.data, local + 30 + e.name.length);
    view.setUint32(central, 0x02014b50, true);
    view.setUint16(central + 4, 20, true);
    view.setUint16(central + 6, 20, true);
    view.setUint32(central + 16, crc, true);
    view.setUint32(central + 20, e.data.length, true);
    view.setUint32(central + 24, e.data.length, true);
    view.setUint16(central + 28, e.name.length, true);
    view.setUint32(central + 42, local, true);
    output.set(e.name, central + 46);
    local += 30 + e.name.length + e.data.length;
    central += 46 + e.name.length;
  }
  view.setUint32(central, 0x06054b50, true);
  view.setUint16(central + 8, entries.length, true);
  view.setUint16(central + 10, entries.length, true);
  view.setUint32(central + 12, centralSize, true);
  view.setUint32(central + 16, localSize, true);
  return output;
}

export function seasonalExcel(csv: string): Uint8Array<ArrayBuffer> {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (
    rows[0]?.join(',') !== 'invoice_id,product_id,product_name,paid_date,quantity,season,holiday' ||
    rows.some((r) => r.length !== 7)
  )
    throw new Error('Dữ liệu xuất chưa đúng định dạng CSV. Vui lòng tải lại.');
  rows[0] = ['Mã đơn', 'Mã mẫu hoa', 'Mẫu hoa', 'Ngày thanh toán', 'Số bó', 'Mùa', 'Dịp lễ'];
  const sheetRows = rows
    .map(
      (r, i) =>
        `<row r="${i + 1}">${r
          .map((value, j) => {
            const ref = `${String.fromCharCode(65 + j)}${i + 1}`;
            if (i > 0 && j === 4 && /^\d+$/.test(value)) return `<c r="${ref}"><v>${value}</v></c>`;
            return `<c r="${ref}" t="inlineStr"${i === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
          })
          .join('')}</row>`,
    )
    .join('');
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Doanh số" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF24543B"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><dimension ref="A1:G${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="38" customWidth="1"/><col min="3" max="3" width="52" customWidth="1"/><col min="4" max="4" width="20" customWidth="1"/><col min="5" max="5" width="10" customWidth="1"/><col min="6" max="7" width="24" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:G${rows.length}"/></worksheet>`,
  });
}
