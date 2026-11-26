import { describe, expect, it } from 'vitest';
import {
  normalizeStatement,
  parseStatementPaste,
} from '../apps/web/src/features/finance/components/reconciliation/reconciliation.utils';

describe('reconciliation statement input', () => {
  it('accepts two Excel columns, optional headers and duplicate transaction IDs', () => {
    expect(parseStatementPaste('Mã giao dịch\tSố tiền\r\nA\t10000\r\nA\t5000\r\nB\t20000')).toEqual(
      [
        { txn: 'A', amount: 15000 },
        { txn: 'B', amount: 20000 },
      ],
    );
  });
  it('rejects extra bank fields, fractional amounts and unsafe sums', () => {
    expect(() => parseStatementPaste('A\t100\taccount')).toThrow('hai cột');
    expect(() => parseStatementPaste('A\t1.5')).toThrow('hai cột');
    expect(() =>
      normalizeStatement([
        { txn: 'A', amount: Number.MAX_SAFE_INTEGER },
        { txn: 'A', amount: 1 },
      ]),
    ).toThrow('giới hạn');
    expect(() => normalizeStatement([{ txn: ' A ', amount: 100 }])).toThrow('mã giao dịch');
    expect(() => normalizeStatement([{ txn: 'A', amount: 0 }])).toThrow('nguyên dương');
  });
  it('enforces the statement size limit', () => {
    expect(() =>
      normalizeStatement(Array.from({ length: 5001 }, (_, i) => ({ txn: String(i), amount: 1 }))),
    ).toThrow('5.000');
  });
});
