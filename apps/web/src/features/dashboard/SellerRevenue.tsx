import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request } from '@/shared/lib/api';
import { CustomSelect } from '@/shared/components/CustomSelect';
import {
  loadRevenueBuckets,
  revenueBuckets,
  revenueRange,
  vietnamMonth,
  type RevenueView,
} from './seller-revenue.utils';
import styles from './styles/seller-revenue.module.css';

type Report = components['schemas']['SellerSalesReportResponse'];
type Point = { label: string; value: number; orders?: number };
const money = (value: number | string) =>
  Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
export default function SellerRevenue({ sellerId }: { sellerId: string }) {
  const [view, setView] = useState<RevenueView>('month');
  const [month, setMonth] = useState(() => vietnamMonth());
  const [year, setYear] = useState(() => vietnamMonth().slice(0, 4));
  const [selected, setSelected] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    point: Point;
    index: number;
    left: number;
    top: number;
  } | null>(null);
  const tooltipId = useId();
  const tooltipAnchor = useRef<HTMLButtonElement | null>(null);
  const tooltipOpen = tooltip !== null;
  useEffect(() => {
    if (!tooltipOpen) return;
    const close = () => setTooltip(null);
    const outside = (event: PointerEvent) => {
      if (!tooltipAnchor.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [tooltipOpen]);
  const showTooltip = (point: Point, index: number, button: HTMLButtonElement) => {
    const rect = (button.querySelector('[data-revenue-bar]') ?? button).getBoundingClientRect();
    tooltipAnchor.current = button;
    setTooltip({
      point,
      index,
      left: Math.max(8, Math.min(window.innerWidth - 216, rect.left + rect.width / 2 - 104)),
      top: Math.max(8, Math.min(window.innerHeight - 116, rect.top - 112)),
    });
  };
  const currentMonth = vietnamMonth();
  const years = Array.from({ length: Number(currentMonth.slice(0, 4)) - 1999 }, (_, i) => {
    const value = String(Number(currentMonth.slice(0, 4)) - i);
    return { value, label: value };
  });
  const period =
    view === 'month' ? revenueRange(`${year}-01-01`, `${year}-12-31`) : `month=${month}`;
  const base = `/sellers/${sellerId}/reports/sales`;
  const read = (params: string) => request<Report>(`${base}${params ? `?${params}` : ''}`);
  const total = useQuery({
    queryKey: ['seller-overview-revenue', sellerId, ''],
    queryFn: () => read(''),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const report = useQuery({
    queryKey: ['seller-overview-revenue', sellerId, period],
    queryFn: () => read(period),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const buckets = revenueBuckets(view, year, month);
  const series = useQuery({
    queryKey: ['seller-overview-revenue-series', sellerId, view, view === 'month' ? year : month],
    queryFn: ({ signal }) => loadRevenueBuckets(buckets, read, signal),
    enabled: buckets.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const timeSeries = view === 'month' || view === 'day';
  const points: Point[] = timeSeries
    ? (series.data ?? []).map((row, i) => ({
        label: buckets[i].label,
        value: Number(row.grossPaid),
        orders: Number(row.paidOrders),
      }))
    : (report.data?.byKiosk ?? []).map((row) => ({
        label: `${row.kioskName} (${row.kioskCode})`,
        value: Number(row.grossPaid),
        orders: Number(row.orderCount),
      }));
  const peak = Math.max(0, ...points.map((point) => point.value));
  const chartQuery = timeSeries ? series : report;
  const scope = view === 'month' ? `Năm ${year}` : `Tháng ${month.slice(5)}/${month.slice(0, 4)}`;
  const reset = () => {
    setSelected(null);
    setTooltip(null);
  };

  return (
    <section className={styles.revenue} aria-labelledby="seller-revenue-title">
      <div className={styles.header}>
        <h2 id="seller-revenue-title">Tổng doanh thu</h2>
        <Link href="/seller/commerce">
          Giao dịch <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.summary}>
        <strong aria-label="Doanh thu toàn thời gian">
          {total.isPending ? '…' : total.isError ? '—' : money(total.data.grossPaid)}
        </strong>
        <small>Thanh toán qua PayOS, chưa trừ hoàn tiền.</small>
      </div>
      {total.isError && (
        <div className={styles.error} role="alert">
          Chưa tải được tổng doanh thu.{' '}
          <button type="button" onClick={() => void total.refetch()}>
            Thử lại tổng doanh thu
          </button>
        </div>
      )}
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Xem doanh thu">
          {(
            [
              ['month', 'Theo tháng'],
              ['day', 'Theo ngày'],
              ['kiosk', 'Theo kiosk'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => {
                setView(key);
                reset();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'month' && (
          <div className={styles.period}>
            <label htmlFor="revenue-year">Năm</label>
            <CustomSelect
              id="revenue-year"
              value={year}
              onValueChange={(value) => {
                setYear(value);
                reset();
              }}
              options={years}
            />
          </div>
        )}
        {(view === 'day' || view === 'kiosk') && (
          <div className={styles.period}>
            <label htmlFor="revenue-month">Tháng</label>
            <CustomSelect
              id="revenue-month"
              value={month.slice(5)}
              options={Array.from({ length: 12 }, (_, i) => {
                const value = String(i + 1).padStart(2, '0');
                return {
                  value,
                  label: String(i + 1),
                  disabled: `${month.slice(0, 4)}-${value}` > currentMonth,
                };
              })}
              onValueChange={(value) => {
                setMonth(`${month.slice(0, 4)}-${value}`);
                reset();
              }}
            />
            <label htmlFor="revenue-period-year">Năm</label>
            <CustomSelect
              id="revenue-period-year"
              value={month.slice(0, 4)}
              options={years}
              onValueChange={(value) => {
                const next = `${value}-${month.slice(5)}`;
                setMonth(next > currentMonth ? currentMonth : next);
                reset();
              }}
            />
          </div>
        )}
      </div>
      {report.isError && (
        <div className={styles.error} role="alert">
          Chưa tải được doanh thu trong kỳ.{' '}
          <button type="button" onClick={() => void report.refetch()}>
            Thử lại
          </button>
        </div>
      )}
      <div className={styles.chartHeader}>
        <strong aria-label={`Doanh thu ${scope.toLowerCase()}`}>
          {report.isPending ? '…' : report.isError ? '—' : money(report.data.grossPaid)}
        </strong>
      </div>
      {chartQuery.isPending ? (
        <p className={styles.state} role="status">
          Đang tải biểu đồ…
        </p>
      ) : chartQuery.isError ? (
        <div className={styles.state} role="alert">
          Chưa tải được biểu đồ.{' '}
          <button type="button" onClick={() => void chartQuery.refetch()}>
            Thử lại
          </button>
        </div>
      ) : peak === 0 ? (
        <p className={styles.state}>
          {!timeSeries && Number(report.data?.grossPaid) > 0
            ? 'Chưa có dữ liệu theo kiosk.'
            : 'Chưa có doanh thu trong kỳ.'}
        </p>
      ) : timeSeries ? (
        <div className={styles.chartScroll}>
          <div className={styles.chart} style={{ minWidth: view === 'day' ? 740 : 480 }}>
            <div className={styles.plot}>
              <div className={styles.grid} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className={styles.columns}>
                {points.map((point, i) => (
                  <button
                    type="button"
                    key={point.label}
                    className={styles.column}
                    aria-pressed={selected === i}
                    aria-label={`${point.label}: ${money(point.value)}, ${point.orders ?? 0} đơn`}
                    aria-describedby={tooltip?.index === i ? tooltipId : undefined}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse') showTooltip(point, i, event.currentTarget);
                    }}
                    onPointerLeave={(event) => {
                      if (event.pointerType === 'mouse') setTooltip(null);
                    }}
                    onFocus={(event) => showTooltip(point, i, event.currentTarget)}
                    onBlur={() => setTooltip(null)}
                    onClick={(event) => {
                      setSelected(i);
                      showTooltip(point, i, event.currentTarget);
                    }}
                  >
                    <span className={styles.barSpace}>
                      <span
                        className={styles.bar}
                        data-revenue-bar=""
                        style={{ height: `${(point.value / peak) * 100}%` }}
                      />
                    </span>
                    <span className={styles.tick}>
                      {view === 'month' ? i + 1 : point.label.slice(0, 2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ul className={styles.kiosks}>
          {points.map((point, i) => (
            <li key={point.label}>
              <button
                type="button"
                aria-pressed={selected === i}
                aria-describedby={tooltip?.index === i ? tooltipId : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') showTooltip(point, i, event.currentTarget);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setTooltip(null);
                }}
                onFocus={(event) => showTooltip(point, i, event.currentTarget)}
                onBlur={() => setTooltip(null)}
                onClick={(event) => {
                  setSelected(i);
                  showTooltip(point, i, event.currentTarget);
                }}
              >
                <span className={styles.kioskName}>{point.label}</span>
                <strong>{money(point.value)}</strong>
                <span className={styles.track} aria-hidden="true">
                  <span style={{ width: `${(point.value / peak) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tooltip &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className={styles.tooltip}
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            <span>{tooltip.point.label}</span>
            <strong>{money(tooltip.point.value)}</strong>
            <small>{tooltip.point.orders ?? 0} đơn</small>
          </div>,
          document.body,
        )}
    </section>
  );
}
