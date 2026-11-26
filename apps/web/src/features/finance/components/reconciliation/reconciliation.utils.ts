export type Statement = { txn: string; amount: number }[];

export function normalizeStatement(rows: Statement): Statement {
  if (rows.length > 5000) throw new Error('Tối đa 5.000 giao dịch mỗi phiên.');
  const totals = new Map<string, number>();
  for (const [index, row] of rows.entries()) {
    if (
      !row.txn ||
      row.txn !== row.txn.trim() ||
      row.txn.length > 200 ||
      Array.from(row.txn).some(
        (char) =>
          char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159),
      )
    )
      throw new Error(`Dòng ${index + 1}: nhập mã giao dịch hợp lệ.`);
    if (!Number.isSafeInteger(row.amount) || row.amount <= 0)
      throw new Error(`Dòng ${index + 1}: số tiền phải là số nguyên dương.`);
    const total = (totals.get(row.txn) ?? 0) + row.amount;
    if (!Number.isSafeInteger(total))
      throw new Error(`Dòng ${index + 1}: tổng tiền vượt giới hạn hỗ trợ.`);
    totals.set(row.txn, total);
  }
  return Array.from(totals, ([txn, amount]) => ({ txn, amount }));
}

// Excel copies two cells as tab-separated text. Accept only txn and integer VND amounts.
export function parseStatementPaste(text: string): Statement {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length > 5001) throw new Error('Tối đa 5.000 giao dịch mỗi phiên.');
  const rows = lines.map((line) => line.split('\t').map((cell) => cell.trim()));
  if (rows[0] && /^(txn|mã giao dịch)$/i.test(rows[0][0])) rows.shift();
  return normalizeStatement(
    rows.map((cells, index) => {
      if (cells.length !== 2 || !/^\d+$/.test(cells[1]))
        throw new Error(
          `Dòng ${index + 1}: dán hai cột mã giao dịch và số tiền nguyên đồng từ Excel.`,
        );
      return { txn: cells[0], amount: Number(cells[1]) };
    }),
  );
}

export const differenceLabels: Record<string, string> = {
  MISSING_IN_DB: 'Chỉ có trên sao kê',
  MISSING_IN_STATEMENT: 'Chỉ có trong hệ thống',
  AMOUNT_MISMATCH: 'Số tiền không khớp',
};

// Only the current visible request may update the report after a hide/unmount or a newer run.
export function createReconciliationGate() {
  let version = 0;
  return {
    begin: () => ++version,
    invalidate: () => {
      version++;
    },
    isCurrent: (request: number) => request === version,
  };
}

export function statementForSubmission(
  rows: Statement,
  pasteOpen: boolean,
  confirmedEmpty: boolean,
): Statement {
  if (pasteOpen) throw new Error('Bấm Dùng dữ liệu hoặc Hủy phần dán trước khi đối chiếu.');
  const statement = normalizeStatement(rows);
  if (!statement.length && !confirmedEmpty)
    throw new Error('Xác nhận sao kê ngày này không có giao dịch.');
  return statement;
}
