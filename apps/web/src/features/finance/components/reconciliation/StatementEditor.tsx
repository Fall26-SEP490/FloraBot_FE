import { Button, Plus, X } from '@florabot/ui';
import styles from './statement-editor.module.css';

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
  return (
    <div className={`statement-editor ${styles.editor}`}>
      <p id="statement-rows-help">Nhập mã giao dịch và số tiền trên sao kê PayOS.</p>
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
            {entries.map((entry, index) => (
              <tr key={entry.key}>
                <td>{index + 1}</td>
                <td>
                  <label className="sr-only" htmlFor={`statement-txn-${entry.key}`}>
                    Mã giao dịch dòng {index + 1}
                  </label>
                  <input
                    id={`statement-txn-${entry.key}`}
                    disabled={disabled}
                    autoComplete="off"
                    maxLength={200}
                    value={entry.txn}
                    placeholder="Nhập mã giao dịch từ PayOS"
                    aria-describedby="statement-rows-help reconciliation-error"
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
                    Số tiền dòng {index + 1}
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
                    placeholder="Ví dụ: 100000"
                    aria-describedby="statement-rows-help reconciliation-error"
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
                    aria-label={`Xóa dòng giao dịch ${index + 1}`}
                    disabled={disabled}
                    onClick={() => {
                      const next = entries[index + 1] || entries[index - 1];
                      onChange(entries.filter((row) => row.key !== entry.key));
                      requestAnimationFrame(() =>
                        document
                          .getElementById(next ? `statement-txn-${next.key}` : 'statement-add')
                          ?.focus(),
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
      <div className="stock-actions">
        <Button
          type="button"
          variant="outline"
          id="statement-add"
          onClick={onAdd}
          disabled={disabled || entries.length >= 5000}
        >
          <Plus size={17} aria-hidden="true" />
          Thêm giao dịch
        </Button>
        <span className="quiet">{entries.length} giao dịch</span>
      </div>
    </div>
  );
}
