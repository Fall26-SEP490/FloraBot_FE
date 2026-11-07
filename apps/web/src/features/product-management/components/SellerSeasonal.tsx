'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '@/shared/lib/api';
import '../../finance/styles/commerce-subscriptions.css';

type Sales = components['schemas']['SeasonalSalesResponse'];
type Forecast = components['schemas']['SeasonalForecastResponse'];
const date = (value: Date) => value.toISOString().slice(0, 10);

export default function SellerSeasonal({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [from, setFrom] = useState(() => date(new Date(Date.now() - 365 * 86400000)));
  const [to, setTo] = useState(() => date(new Date()));
  const [range, setRange] = useState(() => ({
    from: date(new Date(Date.now() - 365 * 86400000)),
    to: date(new Date()),
  }));
  const [target, setTarget] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 7);
  });
  const sales = useQuery({
    queryKey: ['seller-seasonal-sales', sellerId, range],
    enabled: Boolean(sellerId),
    queryFn: () =>
      request<Sales>(`/sellers/${sellerId}/ai/seasonal-sales?from=${range.from}&to=${range.to}`),
  });
  const forecast = useMutation({
    mutationFn: () =>
      request<Forecast>(
        `/sellers/${sellerId}/ai/seasonal-forecast`,
        {
          year: Number(target.slice(0, 4)),
          month: Number(target.slice(5, 7)),
          historyFrom: range.from,
          historyTo: range.to,
        },
        true,
        'POST',
      ),
  });
  if (!sellerId) return <p role="alert">Tài khoản chưa liên kết với shop.</p>;
  return (
    <div className="business-stack">
      <section className="business-panel">
        <h2>Dữ liệu bán hoa thực tế</h2>
        <p>Số liệu theo đơn đã thanh toán của shop. Dữ liệu này tách riêng với dự báo.</p>
        <form
          className="business-inline"
          onSubmit={(event) => {
            event.preventDefault();
            setRange({ from, to });
            forecast.reset();
          }}
        >
          <label>
            Từ ngày{' '}
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              required
            />
          </label>
          <label>
            Đến ngày{' '}
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              required
            />
          </label>
          <Button type="submit">Xem số liệu</Button>
        </form>
        {sales.isPending ? (
          <p role="status">Đang tải số liệu…</p>
        ) : sales.isError ? (
          <p role="alert">{sales.error.message}</p>
        ) : (
          sales.data && (
            <>
              <div className="business-facts">
                <div>
                  <span>Hóa đơn</span>
                  <strong>{sales.data.totalInvoices}</strong>
                </div>
                <div>
                  <span>Số bó</span>
                  <strong>{sales.data.totalUnits}</strong>
                </div>
                <div>
                  <span>Khoảng thời gian</span>
                  <strong>
                    {sales.data.from} – {sales.data.to}
                  </strong>
                </div>
              </div>
              {(sales.data.products ?? []).length ? (
                <div className="business-table-scroll">
                  <table className="business-table">
                    <thead>
                      <tr>
                        <th>Mẫu hoa</th>
                        <th>Hóa đơn</th>
                        <th>Số bó</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sales.data.products ?? []).map((item) => (
                        <tr key={item.productId}>
                          <td>{item.name}</td>
                          <td>{item.totalInvoices}</td>
                          <td>{item.totalUnits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Chưa có giao dịch trong khoảng ngày này.</p>
              )}
            </>
          )
        )}
        <a
          className="button button-outline"
          href={`/api/sellers/${sellerId}/ai/sales.csv?from=${range.from}&to=${range.to}`}
          download
        >
          Tải dữ liệu CSV
        </a>
      </section>
      <section className="business-panel">
        <h2>Ước tính nhu cầu mùa tới</h2>
        <p>Dự báo phụ thuộc dữ liệu lịch sử. Sản phẩm chưa đủ dữ liệu sẽ không có số ước tính.</p>
        <div className="business-inline">
          <label>
            Tháng dự báo{' '}
            <input
              type="month"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          <Button
            disabled={forecast.isPending || sales.isPending}
            onClick={() => forecast.mutate()}
          >
            {forecast.isPending ? 'Đang tính…' : 'Xem dự báo'}
          </Button>
        </div>
        {forecast.isError && <p role="alert">{forecast.error.message}</p>}
        {forecast.data && (
          <>
            <p>
              Giai đoạn dự báo: {forecast.data.forecastStart} – {forecast.data.forecastEnd}
            </p>
            {forecast.data.warnings.map((warning, index) => (
              <p className="business-note" key={index}>
                {warning}
              </p>
            ))}
            <div className="business-card-list">
              {forecast.data.products.map((item) => (
                <article className="business-card" key={item.productId}>
                  <h3>{item.name}</h3>
                  <p>
                    Đã bán trong lịch sử: {item.observedUnits} bó · {item.observedInvoiceCount} hóa
                    đơn
                  </p>
                  <p>
                    {item.forecastUnits == null
                      ? 'Chưa đủ cơ sở để đưa ra số dự báo.'
                      : `Ước tính: ${Number(item.forecastUnits).toLocaleString('vi-VN')} bó`}
                  </p>
                  <small>{item.explanation}</small>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
