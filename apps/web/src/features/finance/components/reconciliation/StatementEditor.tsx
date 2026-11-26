import { Button, Plus, X } from '@florabot/ui';
import styles from './statement-editor.module.css';
import { useState } from 'react';
import SellerPagination from '@/shared/components/SellerPagination';

export type StatementEntry = { key: number; txn: string; amount: string };

export default function StatementEditor({
  entries,
  disabled,
  onChange,
  onAdd,
}: {
  entries: StatementEntry[];
  disabled: boolean;
  onChange: (entries: StatementEntry[]) => void;
  onAdd: () => void;
}) {
  const [page, setPage] = useState(1);
  const last = Math.max(1, Math.ceil(entries.length / 20));
  const current = Math.min(page, last);
  return (
    <div className={`statement-editor ${styles.editor}`}>
      <p id="statement-rows-help" className="sr-only">
        Nhập mã giao dịch và số tiền trên sao kê PayOS.
      </p>
      {entries.length === 0 && (
        <p className="admin-empty-state" role="status">
          Chưa có giao dịch.
        </p>
      )}
      <div className={styles.sheet}>
        <table>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Mã giao dịch</th>
              <th scope="col">Số tiền (đồng)</th>
              <th scope="col">
                <span className="sr-only">Xóa</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.slice((current - 1) * 20, current * 20).map((entry, index) => (
              <tr key={entry.key}>
                <td>{(current - 1) * 20 + index + 1}</td>
                <td>
                  <label className="sr-only" htmlFor={`statement-txn-${entry.key}`}>
                    Mã giao dịch dòng {(current - 1) * 20 + index + 1}
                  </label>
                  <input
                    id={`statement-txn-${entry.key}`}
                    disabled={disabled}
                    autoComplete="off"
                    maxLength={200}
                    value={entry.txn}
                    placeholder="Mã giao dịch"
                    aria-describedby="statement-rows-help"
                    onChange={(event) =>
                      onChange(
                        entries.map((row) =>
                          row.key === entry.key ? { ...row, txn: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <label className="sr-only" htmlFor={`statement-amount-${entry.key}`}>
                    Số tiền dòng {(current - 1) * 20 + index + 1}
                  </label>
                  <input
                    id={`statement-amount-${entry.key}`}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    disabled={disabled}
                    autoComplete="off"
                    value={entry.amount}
                    placeholder="0"
                    aria-describedby="statement-rows-help"
                    onChange={(event) =>
                      onChange(
                        entries.map((row) =>
                          row.key === entry.key ? { ...row, amount: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Xóa dòng giao dịch ${(current - 1) * 20 + index + 1}`}
                    disabled={disabled}
                    onClick={() => {
                      const at = (current - 1) * 20 + index;
                      const next = entries[at + 1] || entries[at - 1];
                      onChange(entries.filter((row) => row.key !== entry.key));
                      requestAnimationFrame(() =>
                        (
                          document.getElementById(
                            next ? `statement-txn-${next.key}` : 'statement-add',
                          ) ?? document.getElementById('statement-add')
                        )?.focus(),
                      );
                    }}
                  >
                    <X size={17} aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <Button
          type="button"
          variant="outline"
          id="statement-add"
          className={styles.add}
          onClick={() => {
            onAdd();
            setPage(Math.ceil((entries.length + 1) / 20));
          }}
          disabled={disabled || entries.length >= 5000}
        >
          <Plus size={17} aria-hidden="true" />
          Thêm giao dịch
        </Button>
        <span>{entries.length} giao dịch</span>
      </div>
      {last > 1 && (
        <SellerPagination page={current} totalPages={last} busy={disabled} onPageChange={setPage} />
      )}
    </div>
  );
}
