'use client';
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal tables need keyboard focus. */

import { useRef, useState } from 'react';
import { Button, Search } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';
import { Modal } from '@/shared/components/Modal';
import Select from '@/shared/components/Select';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import SellerPagination from '@/shared/components/SellerPagination';
import { vietnamDate } from '@/shared/lib/vietnam-date';
import { revenueInteger } from '@/features/dashboard/revenue-report.utils';
import type { DailyReconciliationResult, GatewayReconciliationResult } from '../../finance.types';
import StatementEditor, { type StatementEntry } from './StatementEditor';
import { differenceLabels, normalizeStatement, parseStatementPaste } from './reconciliation.utils';
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
  'Sổ cái cân (tổng mọi bút toán)': 'Cân đối sổ cái',
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

  async function run(kind: 'daily' | 'gateway') {
    if (sending.current) return;
    if (!day) {
      setError('Chọn ngày đối soát.');
      return;
    }
    try {
      const statement =
        kind === 'gateway'
          ? normalizeStatement(entries.map((row) => ({ txn: row.txn, amount: Number(row.amount) })))
          : [];
      if (kind === 'gateway' && !statement.length && !empty)
        throw new Error('Xác nhận sao kê ngày này không có giao dịch.');
      sending.current = true;
      setBusy(true);
      setError('');
      if (kind === 'daily') {
        const data = await request<DailyReconciliationResult>(
          '/admin/flows/reconcile_daily',
          { p_date: day },
          false,
        );
        setDaily({ day, data });
      } else {
        const data = await request<GatewayReconciliationResult>(
          '/admin/flows/reconcile_gateway',
          { p_date: day, p_statement: statement },
          false,
        );
        setGateway({ day, data });
        setPage(1);
        setSearch('');
        setType('');
        setEditorOpen(false);
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : 'Chưa nhận được kết quả. Thử lại sau.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
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
          Giao dịch & sổ cái
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
          Đối chiếu PayOS
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
              {gateway ? 'Sửa sao kê' : 'Nhập sao kê'}
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
          <div
            className={styles.tableScroll}
            aria-busy={busy}
            role="region"
            aria-label="Bảng giao dịch và sổ cái"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th className={styles.number}>Chứng từ</th>
                  <th className={styles.number}>Sổ cái</th>
                  <th className={styles.number}>Chênh lệch</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {daily?.data.result.map((row) => {
                  const count = row.muc === 'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)';
                  const balance = row.muc === 'Sổ cái cân (tổng mọi bút toán)';
                  const pending = row.muc === 'Tiền đang chờ hoàn (REFUND_CLEARING)';
                  const value = revenueInteger(
                    count ? row.chung_tu : pending ? row.so_cai : row.lech,
                  );
                  const good = value === 0n;
                  return (
                    <tr key={row.muc}>
                      <td>
                        <strong>{labels[row.muc] || row.muc}</strong>
                        <small>
                          {count
                            ? `Chờ chi quá 48 giờ trước ngày ${date(daily.day)}`
                            : balance || pending
                              ? 'Tại thời điểm kiểm tra'
                              : date(daily.day)}
                        </small>
                      </td>
                      <td className={styles.number}>
                        {count
                          ? `${number(row.chung_tu)} lệnh`
                          : balance || pending
                            ? '—'
                            : money(row.chung_tu)}
                      </td>
                      <td className={styles.number}>{count ? '—' : money(row.so_cai)}</td>
                      <td className={styles.number}>{count || pending ? '—' : money(row.lech)}</td>
                      <td>
                        <span
                          className={styles.badge}
                          data-tone={value === null ? 'muted' : good ? 'success' : 'warning'}
                        >
                          {value === null
                            ? 'Cần kiểm tra'
                            : pending
                              ? good
                                ? 'Không chờ hoàn'
                                : 'Chờ chi trả'
                              : count
                                ? good
                                  ? 'Không quá hạn'
                                  : 'Cần xử lý'
                                : balance
                                  ? good
                                    ? 'Cân'
                                    : 'Chưa cân'
                                  : good
                                    ? 'Khớp'
                                    : 'Có chênh lệch'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!daily?.data.result.length && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      {daily ? 'Không có dữ liệu đối soát.' : 'Chọn ngày và kiểm tra giao dịch.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                    <th className={styles.number}>Hệ thống</th>
                    <th className={styles.number}>Sao kê</th>
                    <th>Kết quả</th>
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
              <SellerPagination
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
          Đối chiếu khoản thu PayOS đã ghi nhận thành công trong ngày với sao kê bạn nhập.
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
              setEntries(rows);
              setError('');
            }}
            onAdd={() => {
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
          <div className={styles.actions}>
            <Button type="submit" disabled={busy}>
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
