'use client';

import IconActionButton from '@/shared/components/IconActionButton';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Button, CircleAlert, ClipboardList, RefreshCw } from '@florabot/ui';
import { queryClient, request, type Session } from '@/shared/lib/api';
import type {
  TechnicianInstallationDetail,
  TechnicianInstallationSummary,
} from './installations.types';
import { technicianErrorMessage } from './technician-errors';
import { TechnicianJobList } from './components/TechnicianJobList';
import { TechnicianJobDetailCard } from './components/TechnicianJobDetailCard';
import '../../shared/styles/kiosk-shared.css';
import './styles/installation-ui.css';
import './styles/technician-installations.css';
import './styles/technician-installation-flow.css';

interface TechnicianInstallationsProps {
  session: Session;
}

export default function TechnicianInstallations({ session }: TechnicianInstallationsProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const detailRef = useRef<HTMLDivElement>(null);
  const scrollPending = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Query: Assigned installation jobs (scoped by signed-in technician)
  const jobsQuery = useQuery({
    queryKey: ['technician-kiosk-installations', session.id],
    queryFn: () => request<TechnicianInstallationSummary[]>('/staff/kiosk-installations'),
  });

  const jobs = jobsQuery.data || [];
  const queues = [
    { value: '', label: 'Tất cả' },
    { value: 'SCHEDULED', label: 'Cần bắt đầu' },
    { value: 'INSTALLING', label: 'Đang lắp đặt' },
    { value: 'AWAITING_HANDOVER', label: 'Chờ nghiệm thu' },
    { value: 'ACTIVE', label: 'Đã bàn giao' },
  ];
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd');
  const jobPriority: Record<string, number> = {
    INSTALLING: 0,
    SCHEDULED: 1,
    AWAITING_HANDOVER: 2,
    ACTIVE: 3,
  };
  const matchingJobs = jobs
    .filter(
      (job) =>
        (!status || job.status === status) &&
        normalize(`${job.shopName} ${job.kioskCode} ${job.installationAddress}`).includes(
          normalize(search.trim()),
        ),
    )
    .sort((a, b) => (jobPriority[a.status] ?? 4) - (jobPriority[b.status] ?? 4));
  const effectiveJobId = matchingJobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : (matchingJobs[0]?.id ?? null);

  // Query: Specific Job Detail (fetch actual detail)
  const jobDetailQuery = useQuery({
    queryKey: ['technician-installation-detail', session.id, effectiveJobId],
    queryFn: () =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${effectiveJobId}`),
    enabled: !!effectiveJobId,
    refetchOnWindowFocus: false,
  });

  const selectedJob = jobDetailQuery.data ?? null;

  useEffect(() => {
    if (!detailOpen || jobDetailQuery.isPending || !scrollPending.current) return;
    scrollPending.current = false;
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [detailOpen, effectiveJobId, jobDetailQuery.isPending]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['technician-kiosk-installations', session.id],
    });
    if (selectedJob?.id) {
      void queryClient.invalidateQueries({
        queryKey: ['technician-installation-detail', session.id, selectedJob.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['technician-installation-evidence', session.id, selectedJob.id],
      });
    }
  };

  return (
    <div className="technician-installations-view" data-detail-open={detailOpen}>
      <div className="dashboard-page-heading">
        <div>
          <h1>Lắp đặt kiosk</h1>
          <p>Xem lịch được giao, tải ảnh và gửi báo cáo lắp đặt.</p>
        </div>
        <IconActionButton
          variant="outline"
          disabled={jobsQuery.isFetching}
          onClick={invalidate}
          action="reload"
          label="Làm mới công việc lắp đặt"
        />
      </div>

      {jobsQuery.isLoading && (
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={16} aria-hidden="true" /> Đang tải danh sách công việc
          được phân công...
        </p>
      )}

      {jobsQuery.isError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            {technicianErrorMessage(
              jobsQuery.error,
              'Không thể tải danh sách công việc. Vui lòng thử lại.',
            )}
          </span>
          <IconActionButton
            variant="outline"
            onClick={() => void jobsQuery.refetch()}
            action="reload"
            label="Tải lại công việc"
          />
        </div>
      )}

      {jobs.length === 0 && !jobsQuery.isLoading && !jobsQuery.isError && (
        <div className="kiosk-empty-state">
          <span className="platform-empty-icon">
            <ClipboardList size={30} aria-hidden="true" />
          </span>
          <h3>Chưa có công việc lắp đặt nào</h3>
          <p>Hiện bạn không có công việc lắp đặt kiosk nào đang chờ thực hiện.</p>
          <p className="platform-empty-hint">
            Công việc sẽ xuất hiện tại đây khi Quản lý vận hành phân công cho bạn.
          </p>
          <Link className="button button-outline" href="/technician">
            Xem công việc kỹ thuật
          </Link>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="technician-workspace-layout">
          <div
            className="technician-list-pane"
            ref={listRef}
            tabIndex={-1}
            aria-label="Danh sách phiếu lắp đặt"
          >
            <nav className="installation-queues" aria-label="Lọc công việc lắp đặt">
              {queues.map((queue) => (
                <button
                  key={queue.value}
                  type="button"
                  aria-pressed={status === queue.value}
                  onClick={() => setStatus(queue.value)}
                >
                  {queue.label}
                  <span>
                    {jobs.filter((job) => !queue.value || job.status === queue.value).length}
                  </span>
                </button>
              ))}
            </nav>
            <div className="technician-list-filters">
              <label htmlFor="installation-search">Tìm phiếu lắp đặt</label>
              <input
                id="installation-search"
                type="search"
                value={search}
                placeholder="Tên shop, mã tủ, địa chỉ"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <p className="technician-list-count" role="status">
              {matchingJobs.length} / {jobs.length} phiếu được giao
            </p>
            <TechnicianJobList
              jobs={matchingJobs}
              selectedJobId={effectiveJobId}
              onSelectJobId={(id) => {
                if (detailOpen && id === effectiveJobId) {
                  detailRef.current?.focus({ preventScroll: true });
                  detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  return;
                }
                scrollPending.current = true;
                setSelectedJobId(id);
                setDetailOpen(true);
              }}
            />
            {matchingJobs.length === 0 && (
              <div className="technician-filter-empty">
                <p>Không có phiếu khớp bộ lọc.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                  }}
                >
                  Bỏ bộ lọc
                </Button>
              </div>
            )}
          </div>
          <div
            className="technician-detail-pane"
            ref={detailRef}
            tabIndex={-1}
            aria-label="Chi tiết phiếu lắp đặt"
          >
            <Button
              variant="outline"
              className="technician-back"
              onClick={() => {
                setDetailOpen(false);
                requestAnimationFrame(() => {
                  listRef.current?.focus({ preventScroll: true });
                  listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                });
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Danh sách lắp đặt
            </Button>

            {jobDetailQuery.isPending && effectiveJobId && (
              <p role="status">Đang tải chi tiết lắp đặt…</p>
            )}

            {jobDetailQuery.isError && (
              <div role="alert">
                <p>
                  {technicianErrorMessage(
                    jobDetailQuery.error,
                    'Chưa đọc được chi tiết. Hãy tải lại trước khi thao tác.',
                  )}
                </p>
                <IconActionButton
                  variant="outline"
                  onClick={() => void jobDetailQuery.refetch()}
                  action="reload"
                  label="Tải lại chi tiết lắp đặt"
                />
              </div>
            )}

            {selectedJob && !jobDetailQuery.isError && (
              <TechnicianJobDetailCard
                key={`${session.id}-${selectedJob.id}`}
                job={selectedJob}
                session={session}
                onInvalidate={invalidate}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
