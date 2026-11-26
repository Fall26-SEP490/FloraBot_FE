import ReportPagination from '@/features/dashboard/components/ReportPagination';
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Scrollable tables must support keyboard navigation. */
import Select from '@/shared/components/Select';
import styles from './reconciliation.module.css';
import { revenueInteger } from '@/features/dashboard/revenue-report.utils';
import { matchesAuditSearch } from '@/features/dashboard/audit-search.utils';
import { AdminFilterBar } from '@/features/portal/components/AdminUi';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { vietnamDateTimeToUtc } from '@/shared/lib/vietnam-date';
import StatementEditor, { type StatementEntry } from './StatementEditor';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import type { DailyReconciliationResult, GatewayReconciliationResult } from '../../finance.types';
import { ApiError, request } from '@/shared/lib/api';

type Daily = DailyReconciliationResult;
type Gateway = GatewayReconciliationResult;
type Statement = { txn: string; amount: number }[];
const integer = (value: number | string) =>
  typeof value === 'string' && /^-?\d+$/.test(value)
    ? BigInt(value).toLocaleString('vi-VN')
    : typeof value === 'number' && Number.isSafeInteger(value)
      ? value.toLocaleString('vi-VN')
      : 'Vượt giới hạn hiển thị chính xác';
const money = (value: number | string | null) =>
  value === null ? 'Không có' : `${integer(value)} đ`;
const labels: Record<string, string> = {
  MISSING_IN_DB: 'Sao kê có, hệ thống chưa có',
  MISSING_IN_STATEMENT: 'Hệ thống có, sao kê chưa có',
  AMOUNT_MISMATCH: 'Số tiền chưa khớp',
};

function parseStatement(value: Statement): Statement {
  if (value.length > 5000) throw new Error('Chỉ nhập tối đa 5.000 giao dịch.');
  const totals = new Map<string, number>();
  for (const item of value as unknown[]) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('txn' in item) ||
      !('amount' in item) ||
      typeof item.txn !== 'string' ||
      item.txn.length < 1 ||
      item.txn.length > 200 ||
      item.txn !== item.txn.trim() ||
      Array.from(item.txn).some(
        (c) => c.charCodeAt(0) < 32 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159),
      ) ||
      typeof item.amount !== 'number' ||
      !Number.isSafeInteger(item.amount) ||
      item.amount <= 0
    )
      throw new Error('Nhập mã giao dịch hợp lệ và số tiền nguyên dương cho từng dòng.');
    const amount = (totals.get(item.txn) ?? 0) + item.amount;
    if (!Number.isSafeInteger(amount))
      throw new Error(
        'Tổng tiền của một mã giao dịch vượt giới hạn nhập chính xác trên trình duyệt.',
      );
    totals.set(item.txn, amount);
  }
  return Array.from(totals, ([txn, amount]) => ({ txn, amount }));
}

export default function AdminReconciliation() {
  const [date, setDate] = useState('');
  const [view, setView] = useState<'daily' | 'statement'>('daily');
  const [entries, setEntries] = useState<StatementEntry[]>([{ key: 0, txn: '', amount: '' }]);
  const nextEntry = useRef(1);
  const [review, setReview] = useState<Statement | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [differenceType, setDifferenceType] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const epoch = useRef(0);
  const sending = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const dateInput = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  useEffect(() => {
    function invalidate() {
      epoch.current++;
    }
    function clearWhenHidden() {
      if (!document.hidden) return;
      epoch.current++;
      sending.current = false;
      setReview(null);
      setDaily(null);
      setGateway(null);
      setBusy(false);
      setError('');
      setNotice('Dữ liệu nhập được giữ. Chạy lại để xem kết quả.');
    }
    document.addEventListener('visibilitychange', clearWhenHidden);
    return () => {
      invalidate();
      document.removeEventListener('visibilitychange', clearWhenHidden);
    };
  }, []);
  function clear() {
    epoch.current++;
    sending.current = false;
    setEntries([{ key: 0, txn: '', amount: '' }]);
    setReview(null);
    setDaily(null);
    setGateway(null);
    setBusy(false);
    setError('');
    setPage(0);
    setDifferenceType('');
    setTransactionSearch('');
    setNotice('Đã xóa dữ liệu trên màn hình.');
  }
  function focusStatement() {
    document
      .getElementById(entries[0] ? `statement-txn-${entries[0].key}` : 'statement-add')
      ?.focus();
  }
  function validDate() {
    let valid = false;
    try {
      valid = date !== '0001-01-01' && Boolean(vietnamDateTimeToUtc(`${date}T00:00`));
    } catch {
      /* Show the same field error for missing or invalid dates. */
    }
    if (!valid) {
      setError('Chọn ngày cần đối soát.');
      dateInput.current?.focus();
      return false;
    }
    return true;
  }
  async function run(kind: 'daily' | 'gateway') {
    if (sending.current || !validDate() || (kind === 'gateway' && review === null)) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const version = ++epoch.current;
    try {
      if (kind === 'daily') {
        setDaily(null);
        const result = await request<Daily>(
          '/admin/flows/reconcile_daily',
          { p_date: date },
          false,
        );
        if (version !== epoch.current) return;
        setDaily(result);
        setNotice('');
      } else {
        setGateway(null);
        const result = await request<Gateway>(
          '/admin/flows/reconcile_gateway',
          { p_date: date, p_statement: review },
          false,
        );
        if (version !== epoch.current) return;
        setGateway(result);
        setPage(0);
        setDifferenceType('');
        setTransactionSearch('');
        setEntries([{ key: 0, txn: '', amount: '' }]);
        setReview(null);
        setNotice('');
      }
    } catch (cause) {
      if (version === epoch.current)
        setError(
          cause instanceof ApiError && cause.status < 500
            ? cause.message
            : 'Chưa nhận được kết quả. Thử lại sau.',
        );
    } finally {
      if (version === epoch.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  const currentItems = new Set([
    'Sổ cái cân (tổng mọi bút toán)',
    'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)',
    'Tiền đang chờ hoàn (REFUND_CLEARING)',
  ]);
  const differences = (gateway?.result ?? []).filter(
    (row) =>
      (!differenceType || row.loai === differenceType) &&
      matchesAuditSearch([row.gateway_txn_id], transactionSearch),
  );
  const lastPage = Math.max(0, Math.ceil(differences.length / 20) - 1);
  const visiblePage = Math.min(page, lastPage);
  const reportDate = date ? date.split('-').reverse().join('/') : '';
  const dayRows = daily?.result.filter((row) => !currentItems.has(row.muc)) ?? [];
  const currentRows = daily?.result.filter((row) => currentItems.has(row.muc)) ?? [];
  return (
    <section className={`admin-reconciliation ${styles.surface}`} aria-label="Đối soát">
      <div className={styles.tabs} role="group" aria-label="Loại đối soát">
        {(
          [
            ['daily', 'Giao dịch & sổ cái'],
            ['statement', 'Đối chiếu PayOS'],
          ] as const
        ).map(([key, title]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            disabled={busy}
            onClick={() => {
              setView(key);
              setError('');
              setNotice('');
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <AdminFilterBar
        label="Ngày đối soát"
        actions={
          <>
            {view === 'daily' && (
              <Button disabled={busy} onClick={() => void run('daily')}>
                {busy ? 'Đang kiểm tra…' : 'Kiểm tra ngày'}
              </Button>
            )}
            {view === 'statement' && (
              <Button variant="outline" disabled={busy} onClick={clear}>
                Xóa dữ liệu nhập
              </Button>
            )}
          </>
        }
      >
        <div>
          <label htmlFor="reconciliation-date">Ngày đối soát</label>
          <VietnamDateInput
            triggerRef={dateInput}
            id="reconciliation-date"
            label="Ngày đối soát (giờ Việt Nam)"
            describedBy="reconciliation-error"
            min="0001-01-02"
            max="9999-12-31"
            value={date}
            disabled={busy}
            onValueChange={(value) => {
              setDate(value);
              setDaily(null);
              setGateway(null);
              setReview(null);
              setError('');
              setNotice('');
            }}
          />
        </div>
      </AdminFilterBar>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {busy && <p role="status">Đang đối soát…</p>}
      <p id="reconciliation-error" role="alert" className="error">
        {error}
      </p>
      {view === 'daily' && !daily && !busy && !error && (
        <p className={styles.empty}>Chọn ngày rồi bấm Kiểm tra ngày.</p>
      )}
      {view === 'daily' && daily && (
        <>
          <section className={styles.result} aria-label="Kết quả trong ngày">
            <header className={styles.heading}>
              <h3>Trong ngày {reportDate}</h3>
              <span>Đơn vị: đồng</span>
            </header>
            <div className={styles.sheet} role="region" aria-label="Bảng đối soát" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Khoản tiền</th>
                    <th scope="col">Tiền giao dịch</th>
                    <th scope="col">Sổ cái</th>
                    <th scope="col">Chênh lệch</th>
                    <th scope="col">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((row) => {
                    const difference = revenueInteger(row.lech);
                    return (
                      <tr key={row.muc}>
                        <th scope="row">
                          {row.muc === 'Tiền vào VietQR (đơn + phí gói)'
                            ? 'Thu tiền đơn & phí thuê'
                            : row.muc === 'Chi hoàn khách/seller (chuyển khoản tay)'
                              ? 'Tiền đã hoàn'
                              : row.muc === 'Chi rút tiền seller'
                                ? 'Shop đã rút tiền'
                                : row.muc}
                        </th>
                        <td className={styles.number}>{money(row.chung_tu)}</td>
                        <td className={styles.number}>{money(row.so_cai)}</td>
                        <td className={styles.number}>{money(row.lech)}</td>
                        <td>
                          <span
                            className={styles.badge}
                            data-tone={
                              difference === null
                                ? 'muted'
                                : difference === 0n
                                  ? 'success'
                                  : 'warning'
                            }
                          >
                            {difference === null
                              ? 'Cần kiểm tra'
                              : difference === 0n
                                ? 'Khớp'
                                : 'Có chênh lệch'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!dayRows.length && <p className={styles.empty}>Không có số liệu trong ngày.</p>}
          </section>
          {!!currentRows.length && (
            <section className={styles.result} aria-label="Số dư hiện tại">
              <header className={styles.heading}>
                <h3>Số dư hiện tại</h3>
                <span>Không phải số dư tại ngày đã chọn</span>
              </header>
              <div className={styles.sheet} role="region" aria-label="Bảng đối soát" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Nội dung</th>
                      <th scope="col">Giá trị</th>
                      <th scope="col">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row) => {
                      const count = row.muc === 'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)';
                      const balance = row.muc === 'Sổ cái cân (tổng mọi bút toán)';
                      const value = revenueInteger(count ? row.chung_tu : row.so_cai);
                      return (
                        <tr key={row.muc}>
                          <th scope="row">
                            {count
                              ? 'Lệnh hoàn quá hạn'
                              : balance
                                ? 'Cân đối sổ cái'
                                : 'Tiền chờ hoàn'}
                            {count && <small>Trước 00:00 ngày {reportDate} ít nhất 48 giờ</small>}
                          </th>
                          <td className={styles.number}>
                            {count ? `${integer(row.chung_tu)} lệnh` : money(row.so_cai)}
                          </td>
                          <td>
                            <span
                              className={styles.badge}
                              data-tone={
                                value === null
                                  ? 'muted'
                                  : balance
                                    ? value === 0n
                                      ? 'success'
                                      : 'warning'
                                    : count && value > 0n
                                      ? 'warning'
                                      : 'muted'
                              }
                            >
                              {value === null
                                ? 'Cần kiểm tra'
                                : balance
                                  ? value === 0n
                                    ? 'Cân'
                                    : 'Chưa cân'
                                  : count
                                    ? value === 0n
                                      ? 'Không quá hạn'
                                      : 'Cần xử lý'
                                    : value === 0n
                                      ? 'Không chờ hoàn'
                                      : 'Chờ chi trả'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      <form
        hidden={view !== 'statement' || Boolean(gateway)}
        className="admin-statement-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (sending.current || !validDate()) return;
          try {
            setReview(
              parseStatement(entries.map(({ txn, amount }) => ({ txn, amount: Number(amount) }))),
            );
            setGateway(null);
            setError('');
            setNotice('');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Kiểm tra lại sao kê.');
            focusStatement();
          }
        }}
      >
        {!review ? (
          <>
            <StatementEditor
              entries={entries}
              disabled={busy}
              onChange={(next) => {
                setEntries(next);
                setGateway(null);
                setNotice('');
                setError('');
              }}
              onAdd={() => {
                const key = nextEntry.current++;
                setEntries((current) =>
                  current.length >= 5000 ? current : [...current, { key, txn: '', amount: '' }],
                );
              }}
            />
            <div className="stock-actions">
              <Button type="submit" disabled={busy}>
                Xem lại dữ liệu
              </Button>
            </div>
          </>
        ) : (
          <section className={styles.result}>
            <header className={styles.heading}>
              <h3 ref={reviewHeading} tabIndex={-1}>
                Xác nhận sao kê
              </h3>
              <span>{reportDate}</span>
            </header>
            <p className={styles.summary}>
              {review.length} mã giao dịch ·{' '}
              <strong>
                {review.reduce((sum, row) => sum + BigInt(row.amount), 0n).toLocaleString('vi-VN')}{' '}
                đ
              </strong>
            </p>
            {review.length === 0 ? (
              <p className={styles.notice}>
                Sao kê trống: các khoản thu PayOS trong ngày sẽ được báo thiếu.
              </p>
            ) : (
              <div className={styles.sheet} role="region" aria-label="Bảng đối soát" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Mã giao dịch</th>
                      <th scope="col">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.map((row) => (
                      <tr key={row.txn}>
                        <td>{row.txn}</td>
                        <td className={styles.number}>{money(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.hint}>
              Đối chiếu dữ liệu bạn nhập với hệ thống; không chuyển tiền.
            </p>
            <div className="stock-actions">
              <Button type="button" disabled={busy} onClick={() => void run('gateway')}>
                Đối chiếu
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setReview(null);
                  requestAnimationFrame(focusStatement);
                }}
              >
                Sửa sao kê
              </Button>
            </div>
          </section>
        )}
      </form>
      {view === 'statement' && gateway && (
        <section className={styles.result} aria-label="Kết quả đối chiếu sao kê">
          <header className={styles.heading}>
            <h3>Kết quả ngày {reportDate}</h3>
            <div className={styles.resultActions}>
              <span>{gateway.result.length} chênh lệch</span>
              <Button
                variant="outline"
                onClick={() => {
                  setGateway(null);
                  setNotice('');
                  setError('');
                  requestAnimationFrame(focusStatement);
                }}
              >
                Đối chiếu mới
              </Button>
            </div>
          </header>
          {gateway.result.length === 0 ? (
            <p className={styles.notice}>Không có chênh lệch với sao kê đã nhập.</p>
          ) : (
            <>
              <div className={styles.filters}>
                <div>
                  <label htmlFor="difference-search">Mã giao dịch</label>
                  <input
                    id="difference-search"
                    type="search"
                    placeholder="Tìm mã giao dịch…"
                    value={transactionSearch}
                    onChange={(event) => {
                      setTransactionSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="difference-type">Chênh lệch</label>
                  <Select
                    id="difference-type"
                    value={differenceType}
                    onChange={(event) => {
                      setDifferenceType(event.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Tất cả</option>
                    {Object.entries(labels).map(([key, title]) => (
                      <option key={key} value={key}>
                        {title}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className={styles.sheet} role="region" aria-label="Bảng đối soát" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Mã giao dịch</th>
                      <th scope="col">Hệ thống</th>
                      <th scope="col">Sao kê</th>
                      <th scope="col">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {differences
                      .slice(visiblePage * 20, (visiblePage + 1) * 20)
                      .map((row, index) => (
                        <tr key={`${row.gateway_txn_id}-${index}`}>
                          <td>{row.gateway_txn_id}</td>
                          <td className={styles.number}>{money(row.he_thong)}</td>
                          <td className={styles.number}>{money(row.sao_ke)}</td>
                          <td>
                            <span className={styles.badge} data-tone="warning">
                              {labels[row.loai] ?? row.loai}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!differences.length && (
                <p className={styles.empty}>Không tìm thấy giao dịch phù hợp.</p>
              )}
              {differences.length > 20 && (
                <ReportPagination
                  ariaLabel="Phân trang chênh lệch"
                  page={visiblePage + 1}
                  totalPages={lastPage + 1}
                  busy={busy}
                  onPageChange={(next) => setPage(next - 1)}
                />
              )}
            </>
          )}
          <p className={styles.hint}>
            Chỉ đối chiếu khoản thu PayOS thành công trong ngày. Sao kê chưa được xác minh với ngân
            hàng.
          </p>
        </section>
      )}
    </section>
  );
}
