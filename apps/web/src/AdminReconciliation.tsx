import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, request } from './api';

type Daily = components['schemas']['DailyReconciliationResult'];
type Gateway = components['schemas']['GatewayReconciliationResult'];
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

function parseStatement(raw: string): Statement {
  if (raw.length > 1_500_000) throw new Error('Sao kê quá lớn. Chỉ nhập tối đa 5.000 dòng.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Nội dung chưa đúng JSON. Dùng mẫu bên dưới và kiểm tra dấu ngoặc, dấu phẩy.');
  }
  if (!Array.isArray(value) || value.length > 5000)
    throw new Error('Sao kê cần là mảng JSON, tối đa 5.000 dòng.');
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
      throw new Error(
        'Mỗi dòng cần txn dài 1–200 ký tự và amount là số nguyên dương không quá 9.007.199.254.740.991. Mã không được có khoảng trắng ở hai đầu hoặc ký tự điều khiển.',
      );
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
  const [raw, setRaw] = useState('');
  const [review, setReview] = useState<Statement | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const epoch = useRef(0);
  const sending = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
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
      setRaw('');
      setReview(null);
      setDaily(null);
      setGateway(null);
      setBusy(false);
      setError('');
      setNotice('Đã xóa dữ liệu đối soát khỏi màn hình khi bạn rời tab.');
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
    setRaw('');
    setReview(null);
    setDaily(null);
    setGateway(null);
    setBusy(false);
    setError('');
    setPage(0);
    setNotice('Đã xóa dữ liệu đối soát khỏi màn hình.');
  }
  function validDate() {
    if (!date || !dateInput.current?.validity.valid || date === '0001-01-01') {
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
        setNotice('Đã tải báo cáo ngày. Các mục tổng hiện tại được ghi rõ bên dưới.');
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
        setRaw('');
        setReview(null);
        setNotice(
          result.result.length
            ? `Có ${result.result.length} chênh lệch cần kiểm tra.`
            : 'Không tìm thấy chênh lệch với sao kê đã cung cấp.',
        );
      }
    } catch (cause) {
      if (version === epoch.current)
        setError(
          cause instanceof ApiError && cause.status < 500
            ? cause.message
            : 'Chưa nhận được báo cáo. Bạn có thể chạy lại; hệ thống có thể đã ghi nhật ký lần trước. Đối soát không chuyển tiền.',
        );
    } finally {
      if (version === epoch.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section className="admin-reconciliation" aria-labelledby="reconciliation-title">
      <h2 id="reconciliation-title">Đối chiếu từng khoản, rõ ràng mỗi ngày</h2>
      <p>
        So sánh sổ cái nội bộ và các khoản thu PAYOS với sao kê bạn cung cấp. Báo cáo chỉ chỉ ra
        chênh lệch, không tạo khoản thu hay chuyển tiền.
      </p>
      <label htmlFor="reconciliation-date">Ngày đối soát (giờ Việt Nam)</label>
      <input
        ref={dateInput}
        id="reconciliation-date"
        aria-describedby="reconciliation-error"
        type="date"
        min="0001-01-02"
        max="9999-12-31"
        value={date}
        disabled={busy}
        onChange={(event) => {
          setDate(event.target.value);
          setDaily(null);
          setGateway(null);
          setReview(null);
          setError('');
          setNotice('');
        }}
      />
      <div className="stock-actions">
        <Button disabled={busy} onClick={() => void run('daily')}>
          Xem báo cáo ngày
        </Button>
        <Button variant="outline" onClick={clear}>
          Xóa dữ liệu trên màn hình
        </Button>
      </div>
      <p role="status">{busy ? 'Đang đối chiếu dữ liệu…' : notice}</p>
      <p id="reconciliation-error" role="alert" className="error">
        {error}
      </p>
      {daily && (
        <div className="reconciliation-report">
          <h3>Báo cáo ngày {date}</h3>
          <p className="quiet">
            Ba mục đầu tính theo ngày đã chọn. Sổ cái cân và tiền chờ hoàn là tổng hiện tại của toàn
            hệ thống. Số lệnh quá 48 giờ chỉ tính lệnh đang chờ, với mốc đầu ngày đã chọn trừ 48
            giờ.
          </p>
          <ul className="reconciliation-rows">
            {daily.result.map((row) => {
              const count = row.muc === 'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)';
              const balance = row.muc === 'Sổ cái cân (tổng mọi bút toán)';
              const clearing = row.muc === 'Tiền đang chờ hoàn (REFUND_CLEARING)';
              return (
                <li key={row.muc}>
                  <h4>{row.muc}</h4>
                  <dl>
                    {count ? (
                      <div>
                        <dt>Số lệnh đang chờ</dt>
                        <dd>{integer(row.chung_tu)} lệnh</dd>
                      </div>
                    ) : (
                      <>
                        {!balance && !clearing && (
                          <div>
                            <dt>Chứng từ</dt>
                            <dd>{money(row.chung_tu)}</dd>
                          </div>
                        )}
                        <div>
                          <dt>{balance || clearing ? 'Sổ cái hiện tại' : 'Sổ cái trong ngày'}</dt>
                          <dd>{money(row.so_cai)}</dd>
                        </div>
                        {!clearing && (
                          <div>
                            <dt>Chênh lệch</dt>
                            <dd>{money(row.lech)}</dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (sending.current || !validDate()) return;
          try {
            setReview(parseStatement(raw));
            setGateway(null);
            setError('');
            setNotice('');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Kiểm tra lại sao kê.');
            input.current?.focus();
          }
        }}
      >
        <h3>Đối soát sao kê PAYOS</h3>
        <p className="quiet">
          Dữ liệu nhập chỉ giữ trong tab hiện tại và được xóa khi bạn rời tab hoặc chọn xóa trên màn
          hình.
        </p>
        <p id="statement-help">
          Dán các khoản thu của đúng ngày đã chọn theo mẫu{' '}
          <code>{'[{"txn":"ma-giao-dich","amount":100000}]'}</code>. Chỉ cần mã giao dịch và số tiền
          đồng; không nhập tên, số tài khoản hay thông tin khách. Các mã trùng được cộng lại. Dùng{' '}
          <code>[]</code> khi sao kê không có khoản thu.
        </p>
        {!review && (
          <>
            <label htmlFor="reconciliation-statement">Nội dung sao kê JSON</label>
            <textarea
              ref={input}
              id="reconciliation-statement"
              value={raw}
              rows={5}
              maxLength={1500000}
              readOnly={busy}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="statement-help reconciliation-error"
              onChange={(event) => {
                setRaw(event.target.value);
                setGateway(null);
                setNotice('');
              }}
            />
            <Button type="submit" disabled={busy}>
              Kiểm tra sao kê
            </Button>
          </>
        )}
        {review && (
          <div className="reconciliation-review">
            <h4 ref={reviewHeading} tabIndex={-1}>
              Kiểm tra trước khi đối soát
            </h4>
            <p>
              Ngày {date} · {review.length} mã giao dịch · Tổng{' '}
              {review.reduce((sum, row) => sum + BigInt(row.amount), 0n).toLocaleString('vi-VN')} đ.
            </p>
            {review.length === 0 && (
              <p>
                Sao kê trống: mọi khoản thu PAYOS thành công trong ngày sẽ được báo là thiếu trên
                sao kê.
              </p>
            )}
            <p>
              Sao kê do bạn nhập, chưa được xác minh trực tiếp với PAYOS. Kết quả và người thực hiện
              được ghi nhật ký.
            </p>
            <div className="stock-actions">
              <Button type="button" disabled={busy} onClick={() => void run('gateway')}>
                Đối soát sao kê đã kiểm tra
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setReview(null);
                  requestAnimationFrame(() => input.current?.focus());
                }}
              >
                Sửa sao kê
              </Button>
            </div>
          </div>
        )}
      </form>
      {gateway && (
        <div className="reconciliation-report">
          <h3>Kết quả sao kê ngày {date}</h3>
          <p>
            Cần tra soát từng chênh lệch với chứng từ và bên thanh toán trước khi xử lý tiền. Không
            có chênh lệch chưa chứng minh sao kê đầy đủ hoặc đã được ngân hàng xác minh.
          </p>
          <ul className="reconciliation-rows">
            {gateway.result.slice(page * 20, (page + 1) * 20).map((row, index) => (
              <li key={`${row.gateway_txn_id}-${index}`}>
                <h4>{labels[row.loai] ?? row.loai}</h4>
                <p>Mã giao dịch: {row.gateway_txn_id}</p>
                <dl>
                  <div>
                    <dt>Hệ thống</dt>
                    <dd>{money(row.he_thong)}</dd>
                  </div>
                  <div>
                    <dt>Sao kê</dt>
                    <dd>{money(row.sao_ke)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {gateway.result.length > 20 && (
            <div className="stock-actions">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Trang chênh lệch trước
              </Button>
              <span>
                Trang {page + 1} / {Math.ceil(gateway.result.length / 20)}
              </span>
              <Button
                variant="outline"
                disabled={(page + 1) * 20 >= gateway.result.length}
                onClick={() => setPage(page + 1)}
              >
                Trang chênh lệch sau
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
