'use client';

import { useState } from 'react';
import { seasonalExcel } from '../seasonal-excel';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '@/shared/lib/api';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { vietnamDate, displayVietnamDate } from '@/shared/lib/vietnam-date';
import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import '../../finance/styles/commerce-subscriptions.css';
import '../../finance/styles/seller-finance.css';

type Sales = components['schemas']['SeasonalSalesResponse'];
type Forecast = components['schemas']['SeasonalForecastResponse'];
type SellingSuggestion = components['schemas']['SeasonalSellingSuggestion'];
const forecastTimeoutMs = 30_000;
const date = vietnamDate;

function forecastWarning(message: string) {
  if (message.startsWith('Forecasts represent observed sales/invoice frequency'))
    return 'Số dự báo chỉ để tham khảo, có thể thấp hơn nhu cầu thực tế nếu từng hết hàng.';
  if (message.startsWith('Annual seasonality is not validated'))
    return 'Dự báo chưa được kiểm chứng theo mùa hằng năm.';
  if (
    message ===
    'Some products have insufficient history (< 70 covered days or < 10 invoice observations) and return null forecasts.'
  )
    return 'Mẫu hoa cần ít nhất 70 ngày dữ liệu và 10 ngày có đơn để dự báo.';
  if (message.startsWith('Poisson regression')) {
    const product = message.match(/for product (.*?);/)?.[1];
    return product
      ? `${product}: dùng cách ước tính đơn giản theo ngày trong tuần vì mô hình chính chưa cho kết quả ổn định.`
      : 'Đang dùng cách ước tính theo ngày trong tuần vì mô hình chính chưa cho kết quả ổn định.';
  }
  return message;
}

export default function SellerSeasonal({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [from, setFrom] = useState(() => date(new Date(Date.now() - 365 * 86400000)));
  const [to, setTo] = useState(() => date(new Date()));
  const [range, setRange] = useState(() => ({
    from: date(new Date(Date.now() - 365 * 86400000)),
    to: date(new Date()),
  }));
  const [target, setTarget] = useState(() => {
    const [year, month] = vietnamDate().split('-').map(Number);
    return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`;
  });
  const [historyYear, historyMonth] = range.to.split('-').map(Number);
  const minTarget = `${historyMonth === 12 ? historyYear + 1 : historyYear}-${String(historyMonth === 12 ? 1 : historyMonth + 1).padStart(2, '0')}`;
  const forecastMonth = target && target >= minTarget ? target : minTarget;
  const sales = useQuery({
    queryKey: ['seller-seasonal-sales', sellerId, range],
    enabled: Boolean(sellerId),
    queryFn: () =>
      request<Sales>(`/sellers/${sellerId}/ai/seasonal-sales?from=${range.from}&to=${range.to}`),
  });
  const [forecastYear, forecastMonthNumber] = forecastMonth.split('-').map(Number);
  const advice = useQuery({
    queryKey: ['seller-seasonal-advice', sellerId, forecastMonth, range],
    enabled: Boolean(sellerId && forecastMonth),
    retry: false,
    queryFn: () =>
      request<SellingSuggestion[]>(
        '/sellers/' +
          sellerId +
          '/ai/seasonal-advice?' +
          new URLSearchParams({
            year: String(forecastYear),
            month: String(forecastMonthNumber),
            historyFrom: range.from,
            historyTo: range.to,
          }),
      ),
  });
  const forecast = useMutation({
    mutationFn: () =>
      request<Forecast>(
        `/sellers/${sellerId}/ai/seasonal-forecast`,
        {
          year: forecastYear,
          month: forecastMonthNumber,
          historyFrom: range.from,
          historyTo: range.to,
        },
        true,
        'POST',
        undefined,
        'json',
        forecastTimeoutMs,
      ),
  });
  const exportCsv = useMutation({
    mutationFn: async (exportRange: typeof range) => {
      const raw = await request<string>(
        `/sellers/${sellerId}/ai/sales.csv?from=${exportRange.from}&to=${exportRange.to}`,
        undefined,
        true,
        'GET',
        undefined,
        'text',
      );
      const blob = new Blob([seasonalExcel(raw)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = `doanh-so-${exportRange.from}-${exportRange.to}.xlsx`;
        document.body.append(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const warnings = [...new Set((forecast.data?.warnings ?? []).map(forecastWarning))];
  if (!sellerId) return <p role="alert">Tài khoản chưa liên kết với shop.</p>;
  return (
    <RefreshRegion className="seller-finance">
      <div className="business-stack seller-seasonal">
        <section className="business-panel seasonal-sales-panel">
          <div className="business-heading">
            <h2>Doanh số thực tế</h2>
            <div className="finance-actions">
              <Button
                variant="outline"
                disabled={exportCsv.isPending}
                onClick={() => exportCsv.mutate(range)}
              >
                {exportCsv.isPending ? 'Đang tải…' : 'Tải Excel'}
              </Button>
              <IconActionButton
                action="reload"
                label="Tải lại doanh số"
                disabled={sales.isFetching}
                onClick={() => sales.refetch()}
              />
            </div>
          </div>
          {exportCsv.isError && <p role="alert">{exportCsv.error.message}</p>}
          <form
            className="business-inline seasonal-filter-form"
            onSubmit={(event) => {
              event.preventDefault();
              setRange({ from, to });
              forecast.reset();
            }}
          >
            <div className="seasonal-filter-fields">
              <label className="seasonal-date-label" htmlFor="seasonal-from">
                <span>Từ ngày</span>
                <VietnamDateInput
                  id="seasonal-from"
                  label="Từ ngày"
                  value={from}
                  max={to < vietnamDate() ? to : vietnamDate()}
                  onValueChange={setFrom}
                  required
                />
              </label>
              <label className="seasonal-date-label" htmlFor="seasonal-to">
                <span>Đến ngày</span>
                <VietnamDateInput
                  id="seasonal-to"
                  label="Đến ngày"
                  value={to}
                  min={from}
                  max={vietnamDate()}
                  onValueChange={setTo}
                  required
                />
              </label>
            </div>
            <Button type="submit" className="seasonal-submit-btn">
              Xem số liệu
            </Button>
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
        </section>
        <section className="business-panel seasonal-forecast-panel">
          <h2>Dự báo nhu cầu</h2>
          <p className="finance-muted">
            Ước tính từ doanh số {displayVietnamDate(range.from)} – {displayVietnamDate(range.to)}.
            Nếu chưa đủ lịch sử, bạn vẫn có thể xem gợi ý bán theo dịp.
          </p>
          <div className="business-inline seasonal-forecast-form">
            <label className="seasonal-date-label" htmlFor="seasonal-month">
              <span>Tháng dự báo</span>
              <VietnamDateInput
                id="seasonal-month"
                label="Tháng dự báo"
                kind="month"
                value={forecastMonth}
                min={minTarget}
                required
                showToday={false}
                onValueChange={(value) => {
                  setTarget(value);
                  forecast.reset();
                }}
              />
            </label>
            <Button
              className="seasonal-submit-btn"
              disabled={forecast.isPending || sales.isPending || !forecastMonth}
              onClick={() => forecast.mutate()}
            >
              {forecast.isPending ? 'Đang tính…' : 'Xem dự báo'}
            </Button>
          </div>
          <section className="seasonal-selling-ideas" aria-labelledby="seasonal-selling-title">
            <h3 id="seasonal-selling-title">Gợi ý bán theo dịp</h3>
            {advice.isPending ? (
              <p role="status">Đang xem dịp trong tháng đã chọn…</p>
            ) : advice.data?.length ? (
              <>
                <p className="finance-muted">
                  Ý tưởng dựa trên lịch và mẫu đang bán của shop. Có thể thử đặt trước để đo mức
                  quan tâm của khách.
                </p>
                <ul>
                  {advice.data.map((idea) => (
                    <li key={idea.occasion}>
                      <h4>
                        {idea.occasion}
                        {idea.date && (
                          <time dateTime={idea.date}>{displayVietnamDate(idea.date)}</time>
                        )}
                      </h4>
                      <p>{idea.offer}</p>
                      <p>{idea.nextStep}</p>
                      {idea.matchingProducts.length > 0 && (
                        <p className="finance-muted">
                          <strong>Mẫu phù hợp trong shop</strong> ·{' '}
                          {idea.matchingProducts.join(', ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p>
                  Thử đăng một bó gọn và một mẫu kèm thiệp, rồi dùng lượt hỏi và đơn đặt trước để
                  chọn mẫu làm thêm.
                </p>
                {advice.isError && (
                  <Button
                    variant="outline"
                    disabled={advice.isFetching}
                    onClick={() => void advice.refetch()}
                  >
                    Thử lại gợi ý theo tháng
                  </Button>
                )}
              </>
            )}
          </section>
          {forecast.isError && (
            <p role="alert">
              {forecast.error.name === 'TimeoutError'
                ? 'Dự báo mất nhiều thời gian hơn dự kiến. Bạn có thể xem gợi ý theo dịp hoặc thử tính lại.'
                : forecast.error.message}
            </p>
          )}
          {forecast.isPending && <p role="status">Đang tạo dự báo…</p>}
          {forecast.data && (
            <>
              <p>
                Giai đoạn dự báo: {displayVietnamDate(forecast.data.forecastStart)} –{' '}
                {displayVietnamDate(forecast.data.forecastEnd)}
              </p>
              {warnings.length > 0 && (
                <div className="seasonal-forecast-notes" aria-label="Lưu ý dự báo">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
              <div className="business-table-scroll">
                <table className="business-table">
                  <thead>
                    <tr>
                      <th>Mẫu hoa</th>
                      <th>Đã bán</th>
                      <th>Hóa đơn</th>
                      <th>Dự báo số bó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.data.products.map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <strong>{item.name}</strong>
                          {item.explanation && (
                            <details className="forecast-explanation">
                              <summary>Chi tiết</summary>
                              <p>{item.explanation}</p>
                            </details>
                          )}
                        </td>
                        <td>{item.observedUnits}</td>
                        <td>{item.observedInvoiceCount}</td>
                        <td className="finance-money">
                          {item.forecastUnits == null ? (
                            <span className="finance-muted">Chưa đủ dữ liệu</span>
                          ) : (
                            Number(item.forecastUnits).toLocaleString('vi-VN')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {forecast.data.products.length === 0 && <p>Chưa có mẫu hoa để dự báo.</p>}
              </div>
            </>
          )}
        </section>
      </div>
    </RefreshRegion>
  );
}
