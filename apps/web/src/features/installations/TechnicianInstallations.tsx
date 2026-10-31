'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, CircleAlert, ClipboardList, RefreshCw } from '@florabot/ui';
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

  // Query: Assigned installation jobs (scoped by signed-in technician)
  const jobsQuery = useQuery({
    queryKey: ['technician-kiosk-installations', session.id],
    queryFn: () => request<TechnicianInstallationSummary[]>('/staff/kiosk-installations'),
  });

  const jobs = jobsQuery.data || [];
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
    <div className="technician-installations-view">
      <div className="dashboard-page-heading">
        <div>
          <span className="installation-eyebrow">Công việc hiện trường</span>
          <h1>Lắp đặt Kiosk được phân công</h1>
          <p>Theo dõi lịch hẹn, ghi nhận ảnh hiện trường và gửi báo cáo nghiệm thu.</p>
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
          <a className="button button-outline" href="/technician">
            Xem công việc kỹ thuật
          </a>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="technician-workspace-layout">
          <TechnicianJobList
            jobs={jobs}
            selectedJobId={selectedJob?.id ?? effectiveJobId}
            onSelectJobId={setSelectedJobId}
          />

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
      )}
    </div>
  );
}
