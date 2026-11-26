'use client';
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal tables need keyboard focus. */
import ReportPagination from '@/features/dashboard/components/ReportPagination';

import { useEffect, useRef, useState } from 'react';
import { Button, Search } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';
import { Modal } from '@/shared/components/Modal';
import Select from '@/shared/components/Select';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { vietnamDateTimeToUtc, vietnamDate } from '@/shared/lib/vietnam-date';
import { revenueInteger } from '@/features/dashboard/revenue-report.utils';
import type { DailyReconciliationResult, GatewayReconciliationResult } from '../../finance.types';
import StatementEditor, { type StatementEntry } from './StatementEditor';
import {
  createReconciliationGate,
  differenceLabels,
  statementForSubmission,
  parseStatementPaste,
} from './reconciliation.utils';
import styles from './reconciliation.module.css';

const number = (value: number | string | null | undefined) => {
  if (value == null) return '—';
  return revenueInteger(value)?.toLocaleString('vi-VN') ?? 'Vượt giới hạn hiển thị';
};
const money = (value: number | string | null | undefined) =>
  value == null ? '—' : `${number(value)} ₫`;
const date = (value: string) => value.split('-').reverse().join('/');
const labels: Record<string, string> = {
  'Tiền vào VietQR (đơn + phí gói)': 'Tiền thu từ đơn & phí thuê',
  'Chi hoàn khách/seller (chuyển khoản tay)': 'Tiền đã hoàn',
  'Chi rút tiền seller': 'Tiền shop đã rút',
  'Sổ cái cân (tổng mọi bút toán)': 'Kiểm tra cân bằng sổ tiền',
  'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)': 'Lệnh hoàn quá 48 giờ',
  'Tiền đang chờ hoàn (REFUND_CLEARING)': 'Tiền chờ hoàn',
};

export default function AdminReconciliation() {
  const [view, setView] = useState<'daily' | 'gateway'>('daily');
  const [day, setDay] = useState(() => vietnamDate());
  const [daily, setDaily] = useState<{ day: string; data: DailyReconciliationResult } | null>(null);
  const [gateway, setGateway] = useState<{ day: string; data: GatewayReconciliationResult } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [entries, setEntries] = useState<StatementEntry[]>([{ key: 0, txn: '', amount: '' }]);
  const nextKey = useRef(1);
  const [paste, setPaste] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const gate = useRef(createReconciliationGate());
  useEffect(() => {
    const currentGate = gate.current;
    function hideResults() {
      if (!document.hidden) return;
      currentGate.invalidate();
      sending.current = false;
      setBusy(false);
      setDaily(null);
      setGateway(null);
      setEditorOpen(false);
      setEmpty(false);
      setError('');
    }
    document.addEventListener('visibilitychange', hideResults);
    return () => {
      currentGate.invalidate();
      document.removeEventListener('visibilitychange', hideResults);
    };
  }, []);

  async function run(kind: 'daily' | 'gateway') {
    if (sending.current) return;
    let version: number | null = null;
    try {
      if (day === '0001-01-01') throw new Error('Chọn ngày đối soát hợp lệ.');
      try {
        vietnamDateTimeToUtc(`${day}T00:00`);
      } catch {
        throw new Error('Chọn ngày đối soát hợp lệ.');
      }
      const statement =
        kind === 'gateway'
          ? statementForSubmission(
              entries.map((row) => ({ txn: row.txn, amount: Number(row.amount) })),
              paste !== null,
              empty,
            )
          : [];
      version = gate.current.begin();
      sending.current = true;
      setBusy(true);
      setError('');
      if (kind === 'daily') {
        setDaily(null);
        const data = await request<DailyReconciliationResult>(
          '/admin/flows/reconcile_daily',
          { p_date: day },
          false,
        );
        if (!gate.current.isCurrent(version)) return;
        setDaily({ day, data });
      } else {
        setGateway(null);
        const data = await request<GatewayReconciliationResult>(
          '/admin/flows/reconcile_gateway',
          { p_date: day, p_statement: statement },
          false,
        );
        if (!gate.current.isCurrent(version)) return;
        setGateway({ day, data });
        setPage(1);
        setSearch('');
        setType('');
        setEditorOpen(false);
      }
    } catch (cause) {
      if (version !== null && !gate.current.isCurrent(version)) return;
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : 'Chưa nhận được kết quả. Thử lại sau.',
      );
    } finally {
      if (version === null || gate.current.isCurrent(version)) {
        sending.current = false;
        setBusy(false);
      }
    }
  }

  const differences = (gateway?.data.result ?? []).filter(
    (row) =>
      (!type || row.loai === type) &&
      (row.gateway_txn_id ?? '')
        .toLocaleLowerCase('vi-VN')
        .includes(search.trim().toLocaleLowerCase('vi-VN')),
  );
  const lastPage = Math.max(1, Math.ceil(differences.length / 20));
  const currentPage = Math.min(page, lastPage);
  const currentItems = new Set([
    'Sổ cái cân (tổng mọi bút toán)',
    'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)',
    'Tiền đang chờ hoàn (REFUND_CLEARING)',
  ]);
  const dayRows = daily?.data.result.filter((row) => !currentItems.has(row.muc)) ?? [];
  const currentRows = daily?.data.result.filter((row) => currentItems.has(row.muc)) ?? [];

  return (
    <section className={`admin-reconciliation ${styles.surface}`} aria-label="Đối soát">
      <div className={styles.tabs} role="group" aria-label="Loại đối soát">
        <button
          type="button"
          aria-pressed={view === 'daily'}
          disabled={busy}
          onClick={() => {
            setView('daily');
            setError('');
          }}
        >
          Kiểm tra tiền trong hệ thống
        </button>
        <button
          type="button"
          aria-pressed={view === 'gateway'}
          disabled={busy}
          onClick={() => {
            setView('gateway');
            setError('');
          }}
        >
          So sánh sao kê PayOS
        </button>
      </div>
      <div className={styles.sheet}>
        <div className={styles.toolbar}>
          <div className={styles.dayField}>
            <label htmlFor="reconciliation-date">Ngày đối soát</label>
            <VietnamDateInput
              id="reconciliation-date"
              label="Ngày đối soát"
              value={day}
              min="0001-01-02"
              required
              disabled={busy}
              onValueChange={(value) => {
                gate.current.invalidate();
                setEmpty(false);
                setDay(value);
                setDaily(null);
                setGateway(null);
                setError('');
              }}
            />
          </div>
          {view === 'daily' ? (
            <Button type="button" disabled={busy} onClick={() => void run('daily')}>
              {busy ? 'Đang kiểm tra…' : 'Kiểm tra ngày'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditorOpen(true);
                setError('');
              }}
            >
              {gateway ? 'Sửa sao kê' : 'Nhập sao kê PayOS'}
            </Button>
          )}
          {view === 'gateway' && gateway && (
            <span className={styles.hint}>
              {gateway.data.result.length} khoản chênh lệch · {date(gateway.day)}
            </span>
          )}
        </div>
        {busy && (
          <div className={styles.progress} role="status">
            Đang đối soát…
          </div>
        )}
        {error && !editorOpen && (
          <p className={`error ${styles.feedback}`} role="alert">
            {error}
          </p>
        )}
        {view === 'daily' ? (
          <>
            {daily && <h3 className={styles.sectionTitle}>Thu chi ngày {date(daily.day)}</h3>}
            <div
              className={styles.tableScroll}
              aria-busy={busy}
              role="region"
              aria-label="Bảng thu chi trong ngày"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Khoản tiền</th>
                    <th scope="col" className={styles.number}>
                      Theo giao dịch
                    </th>
                    <th scope="col" className={styles.number}>
                      Theo sổ kế toán
                    </th>
                    <th scope="col" className={styles.number}>
                      Số tiền lệch
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((row) => {
                    const difference = revenueInteger(row.lech);
                    return (
                      <tr key={row.muc}>
                        <td>
                          <strong>{labels[row.muc] || row.muc}</strong>
                        </td>
                        <td className={styles.number}>{money(row.chung_tu)}</td>
                        <td className={styles.number}>{money(row.so_cai)}</td>
                        <td className={styles.number}>
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
                            {money(row.lech)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!dayRows.length && (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        {daily ? 'Không có dữ liệu thu chi.' : 'Chọn ngày và kiểm tra giao dịch.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!!currentRows.length && (
              <>
                <header className={styles.currentHeading}>
                  <h3>Số dư & khoản chờ xử lý</h3>
                </header>
                <div
                  className={styles.tableScroll}
                  role="region"
                  aria-label="Bảng số dư và khoản chờ xử lý"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Nội dung</th>
                        <th scope="col" className={styles.number}>
                          Giá trị
                        </th>
                        <th scope="col">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRows.map((row) => {
                        const count = row.muc === 'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)';
                        const balance = row.muc === 'Sổ cái cân (tổng mọi bút toán)';
                        const value = revenueInteger(count ? row.chung_tu : row.so_cai);
                        return (
                          <tr key={row.muc}>
                            <td>
                              <strong>{labels[row.muc] || row.muc}</strong>
                              {count && daily && (
                                <small>Mốc tính: đầu ngày {date(daily.day)} trừ 48 giờ</small>
                              )}
                            </td>
                            <td className={styles.number}>
                              {count ? `${number(row.chung_tu)} lệnh` : money(row.so_cai)}
                            </td>
                            <td>
                              <span
                                className={styles.badge}
                                data-tone={
                                  value === null ? 'muted' : value === 0n ? 'success' : 'warning'
                                }
                              >
                                {value === null
                                  ? 'Cần kiểm tra'
                                  : balance
                                    ? value === 0n
                                      ? 'Cân bằng'
                                      : 'Chưa cân bằng'
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
              </>
            )}
          </>
        ) : (
          <>
            {gateway && !!gateway.data.result.length && (
              <div className={styles.toolbar}>
                <div className={styles.search}>
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Tìm mã giao dịch"
                    placeholder="Mã giao dịch"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <Select
                  aria-label="Loại chênh lệch"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả chênh lệch</option>
                  {Object.entries(differenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div
              className={styles.tableScroll}
              aria-busy={busy}
              role="region"
              aria-label="Bảng chênh lệch PayOS"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Mã giao dịch</th>
                    <th className={styles.number}>Theo hệ thống</th>
                    <th className={styles.number}>Theo sao kê</th>
                    <th>Điểm chưa khớp</th>
                  </tr>
                </thead>
                <tbody>
                  {differences.slice((currentPage - 1) * 20, currentPage * 20).map((row, index) => (
                    <tr key={`${row.gateway_txn_id}-${index}`}>
                      <td>
                        <strong>{row.gateway_txn_id || 'Không có mã giao dịch'}</strong>
                      </td>
                      <td className={styles.number}>{money(row.he_thong)}</td>
                      <td className={styles.number}>{money(row.sao_ke)}</td>
                      <td>
                        <span className={styles.badge} data-tone="warning">
                          {differenceLabels[row.loai] || row.loai}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!differences.length && (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        {!gateway
                          ? 'Nhập sao kê để đối chiếu giao dịch PayOS.'
                          : gateway.data.result.length
                            ? 'Không có giao dịch phù hợp với bộ lọc.'
                            : 'Không phát hiện chênh lệch với sao kê đã nhập.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {lastPage > 1 && (
              <ReportPagination
                ariaLabel="Phân trang chênh lệch"
                page={currentPage}
                totalPages={lastPage}
                busy={busy}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
      {view === 'gateway' && (
        <p className={styles.hint}>
          So sánh khoản thu thành công trong ngày với sao kê bạn nhập từ PayOS.
        </p>
      )}
      <Modal
        open={editorOpen}
        title="Sao kê PayOS"
        size="lg"
        onClose={() => setEditorOpen(false)}
        closeDisabled={busy}
        className={styles.modal}
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void run('gateway');
          }}
        >
          <div className={styles.heading}>
            <strong>Ngày {date(day)}</strong>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPaste('');
                setError('');
              }}
            >
              Dán từ Excel
            </Button>
          </div>
          {paste !== null && (
            <div className={styles.paste}>
              <label htmlFor="statement-paste">Hai cột: mã giao dịch và số tiền (đồng)</label>
              <textarea
                id="statement-paste"
                value={paste}
                rows={4}
                disabled={busy}
                onChange={(event) => setPaste(event.target.value)}
              />
              <div className={styles.actions}>
                <Button
                  type="button"
                  disabled={busy || !paste.trim()}
                  onClick={() => {
                    try {
                      setEntries(
                        parseStatementPaste(paste).map((row) => ({
                          key: nextKey.current++,
                          txn: row.txn,
                          amount: String(row.amount),
                        })),
                      );
                      setPaste(null);
                      setError('');
                      setEmpty(false);
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : 'Kiểm tra dữ liệu đã dán.');
                    }
                  }}
                >
                  Dùng dữ liệu
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setPaste(null)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
          <StatementEditor
            entries={entries}
            disabled={busy}
            onChange={(rows) => {
              setEmpty(false);
              setEntries(rows);
              setError('');
            }}
            onAdd={() => {
              setEmpty(false);
              const key = nextKey.current++;
              setEntries((rows) => [...rows, { key, txn: '', amount: '' }]);
            }}
          />
          {!entries.length && (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={empty}
                disabled={busy}
                onChange={(event) => setEmpty(event.target.checked)}
              />
              Sao kê ngày này không có giao dịch
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {paste !== null && (
            <p className={styles.hint}>Bấm Dùng dữ liệu hoặc Hủy trước khi đối chiếu.</p>
          )}
          <div className={styles.actions}>
            <Button type="submit" disabled={busy || paste !== null}>
              {busy ? 'Đang đối chiếu…' : 'Đối chiếu'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEditorOpen(false)}
            >
              Đóng
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
