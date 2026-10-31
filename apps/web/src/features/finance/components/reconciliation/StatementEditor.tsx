import { Button, Plus, X } from '@florabot/ui';

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
    <div className="statement-editor">
      <p id="statement-rows-help">
        Nhập mã giao dịch và số tiền nguyên theo đồng. Không nhập tên, số tài khoản hoặc thông tin
        khách hàng. Các mã trùng sẽ được cộng lại khi kiểm tra.
      </p>
      {entries.length === 0 && (
        <p className="admin-empty-state" role="status">
          Sao kê hiện không có giao dịch. Bạn có thể thêm dòng, hoặc kiểm tra sao kê trống để đối
          chiếu.
        </p>
      )}
      <div className="statement-entry-list">
        {entries.map((entry, index) => (
          <fieldset key={entry.key} className="statement-entry" disabled={disabled}>
            <legend>Giao dịch {index + 1}</legend>
            <div>
              <label htmlFor={`statement-txn-${entry.key}`}>Mã giao dịch {index + 1}</label>
              <input
                id={`statement-txn-${entry.key}`}
                autoComplete="off"
                maxLength={200}
                value={entry.txn}
                placeholder="Mã trên sao kê"
                aria-describedby="statement-rows-help reconciliation-error"
                onChange={(event) =>
                  onChange(
                    entries.map((row) =>
                      row.key === entry.key ? { ...row, txn: event.target.value } : row,
                    ),
                  )
                }
              />
            </div>
            <div>
              <label htmlFor={`statement-amount-${entry.key}`}>
                Số tiền giao dịch {index + 1} (đồng)
              </label>
              <input
                id={`statement-amount-${entry.key}`}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
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
            </div>
            <Button
              type="button"
              variant="outline"
              aria-label={`Xóa dòng giao dịch ${index + 1}`}
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
              <span>Xóa dòng</span>
            </Button>
          </fieldset>
        ))}
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
        <span className="quiet">{entries.length} / 5.000 dòng · chỉ giữ trong tab này</span>
      </div>
    </div>
  );
}
