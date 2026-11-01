'use client';

import { useRef, useState } from 'react';
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

interface TechnicianInstallationsProps {
  session: Session;
}

export default function TechnicianInstallations({ session }: TechnicianInstallationsProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Query: Assigned installation jobs (scoped by signed-in technician)
  const jobsQuery = useQuery({
    queryKey: ['technician-kiosk-installations', session.id],
    queryFn: () => request<TechnicianInstallationSummary[]>('/staff/kiosk-installations'),
  });

  const jobs = jobsQuery.data || [];
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd');
  const matchingJobs = jobs.filter(
    (job) =>
      (!status || job.status === status) &&
      normalize(`${job.shopName} ${job.kioskCode} ${job.installationAddress}`).includes(
        normalize(search.trim()),
      ),
  );
  const initialJobId = jobs.length > 0 ? jobs[0].id : null;
  const effectiveJobId = jobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : initialJobId;

  // Query: Specific Job Detail (fetch actual detail)
  const jobDetailQuery = useQuery({
    queryKey: ['technician-installation-detail', session.id, effectiveJobId],
    queryFn: () =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${effectiveJobId}`),
    enabled: !!effectiveJobId,
    refetchOnWindowFocus: false,
  });

  const selectedJob = jobDetailQuery.data ?? null;

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
        <Button variant="outline" disabled={jobsQuery.isFetching} onClick={invalidate}>
          <RefreshCw size={16} aria-hidden="true" /> Làm mới công việc lắp đặt
        </Button>
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
          <Button variant="outline" onClick={() => void jobsQuery.refetch()}>
            Tải lại công việc
          </Button>
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
            <div className="technician-list-filters">
              <label htmlFor="installation-search">Tìm phiếu lắp đặt</label>
              <input
                id="installation-search"
                type="search"
                value={search}
                placeholder="Tên shop, mã tủ, địa chỉ"
                onChange={(event) => setSearch(event.target.value)}
              />
              <label htmlFor="installation-status">Trạng thái</label>
              <select
                id="installation-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="SCHEDULED">Đã xếp lịch</option>
                <option value="INSTALLING">Đang lắp đặt</option>
                <option value="AWAITING_HANDOVER">Chờ bàn giao</option>
                <option value="ACTIVE">Đã bàn giao</option>
              </select>
            </div>
            <p className="technician-list-count" role="status">
              {matchingJobs.length} / {jobs.length} phiếu được giao
            </p>
            <TechnicianJobList
              jobs={matchingJobs}
              selectedJobId={effectiveJobId}
              onSelectJobId={(id) => {
                setSelectedJobId(id);
                setDetailOpen(true);
                requestAnimationFrame(() => detailRef.current?.focus());
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
                requestAnimationFrame(() => listRef.current?.focus());
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
                <Button variant="outline" onClick={() => void jobDetailQuery.refetch()}>
                  Tải lại chi tiết lắp đặt
                </Button>
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
