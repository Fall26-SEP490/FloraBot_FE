'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Plus } from '@florabot/ui';
import { DataTable, TablePagination, type DataTableColumn } from './DataTable';
import { ConfirmDialog, Modal } from './Modal';
import { paginate } from './pagination';

export type ManagementRole = 'ADMIN' | 'SELLER' | 'SELLER_STAFF';

type ManagementRecord = {
  id: string;
  name: string;
  reference: string;
  owner: string;
  status: string;
};

type RoleConfig = {
  eyebrow: string;
  title: string;
  description: string;
  itemName: string;
  nameLabel: string;
  referenceLabel: string;
  ownerLabel: string;
  createLabel: string;
  canCreate: boolean;
  canDisable: boolean;
  detailsEditable: boolean;
  inactiveStatus?: string;
  statuses: readonly { value: string; label: string }[];
  initialRecords: readonly ManagementRecord[];
};

const configs: Record<ManagementRole, RoleConfig> = {
  ADMIN: {
    eyebrow: 'Quản trị hệ thống',
    title: 'Tài khoản vận hành',
    description: 'Theo dõi tài khoản seller và nhân viên theo cùng một chuẩn bảng.',
    itemName: 'tài khoản',
    nameLabel: 'Họ và tên',
    referenceLabel: 'Email',
    ownerLabel: 'Vai trò',
    createLabel: '',
    canCreate: false,
    canDisable: false,
    detailsEditable: false,
    inactiveStatus: 'INACTIVE',
    statuses: [
      { value: 'ACTIVE', label: 'Đang hoạt động' },
      { value: 'PENDING', label: 'Chờ kích hoạt' },
      { value: 'INACTIVE', label: 'Đã vô hiệu hóa' },
    ],
    initialRecords: [
      {
        id: 'admin-01',
        name: 'Nguyễn Minh An',
        reference: 'an@hoasaigon.vn',
        owner: 'Seller',
        status: 'ACTIVE',
      },
      {
        id: 'admin-02',
        name: 'Trần Thị Bích',
        reference: 'bich@hoamoc.vn',
        owner: 'Seller',
        status: 'ACTIVE',
      },
      {
        id: 'admin-03',
        name: 'Lê Văn Cường',
        reference: 'cuong@hoamoc.vn',
        owner: 'Staff',
        status: 'PENDING',
      },
      {
        id: 'admin-04',
        name: 'Phạm Thu Dung',
        reference: 'dung@hoasaigon.vn',
        owner: 'Staff',
        status: 'ACTIVE',
      },
      {
        id: 'admin-05',
        name: 'Ngô Thị Hoa',
        reference: 'hoa@hoamoc.vn',
        owner: 'Staff',
        status: 'INACTIVE',
      },
      {
        id: 'admin-06',
        name: 'Vũ Quốc Huy',
        reference: 'huy@hoanhietdoi.vn',
        owner: 'Seller',
        status: 'ACTIVE',
      },
    ],
  },
  SELLER: {
    eyebrow: 'Vận hành cửa hàng',
    title: 'Danh mục mẫu hoa',
    description: 'Quản lý nhanh mẫu hoa, mã sản phẩm và người phụ trách.',
    itemName: 'mẫu hoa',
    nameLabel: 'Tên mẫu hoa',
    referenceLabel: 'Mã SKU',
    ownerLabel: 'Người phụ trách',
    createLabel: '',
    canCreate: false,
    canDisable: false,
    detailsEditable: false,
    inactiveStatus: 'INACTIVE',
    statuses: [
      { value: 'ACTIVE', label: 'Đang bán' },
      { value: 'DRAFT', label: 'Bản nháp' },
      { value: 'INACTIVE', label: 'Ngừng bán' },
    ],
    initialRecords: [
      {
        id: 'seller-01',
        name: 'Bó hồng pastel',
        reference: 'HB-PASTEL-01',
        owner: 'Mai Anh',
        status: 'ACTIVE',
      },
      {
        id: 'seller-02',
        name: 'Giỏ hướng dương',
        reference: 'GH-HD-02',
        owner: 'Quang Huy',
        status: 'ACTIVE',
      },
      {
        id: 'seller-03',
        name: 'Tulip ngày mới',
        reference: 'TL-NM-03',
        owner: 'Mai Anh',
        status: 'DRAFT',
      },
      {
        id: 'seller-04',
        name: 'Cẩm tú cầu xanh',
        reference: 'CTC-X-04',
        owner: 'Thu Hà',
        status: 'ACTIVE',
      },
      {
        id: 'seller-05',
        name: 'Hoa bàn thanh lịch',
        reference: 'HB-TL-05',
        owner: 'Thu Hà',
        status: 'INACTIVE',
      },
      {
        id: 'seller-06',
        name: 'Mùa xuân dịu dàng',
        reference: 'MX-DD-06',
        owner: 'Quang Huy',
        status: 'ACTIVE',
      },
    ],
  },
  SELLER_STAFF: {
    eyebrow: 'Công việc trong ca',
    title: 'Danh sách công việc mẫu',
    description: 'Nhân viên chỉ xem chi tiết và cập nhật trạng thái công việc được giao.',
    itemName: 'công việc',
    nameLabel: 'Nội dung',
    referenceLabel: 'Tủ hoa',
    ownerLabel: 'Người giao việc',
    createLabel: '',
    canCreate: false,
    canDisable: false,
    detailsEditable: false,
    statuses: [
      { value: 'ASSIGNED', label: 'Đã giao' },
      { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
      { value: 'COMPLETED', label: 'Hoàn thành' },
    ],
    initialRecords: [
      {
        id: 'staff-01',
        name: 'Nạp hoa ngăn A01–A04',
        reference: 'Tủ Đại học FPT',
        owner: 'Mai Anh',
        status: 'ASSIGNED',
      },
      {
        id: 'staff-02',
        name: 'Kiểm đếm hoa cuối ca',
        reference: 'Tủ Vincom Thủ Đức',
        owner: 'Quang Huy',
        status: 'IN_PROGRESS',
      },
      {
        id: 'staff-03',
        name: 'Chụp ảnh đối soát',
        reference: 'Tủ Đại học FPT',
        owner: 'Mai Anh',
        status: 'COMPLETED',
      },
      {
        id: 'staff-04',
        name: 'Thu hồi hoa hết hạn',
        reference: 'Tủ Nhà Văn hóa',
        owner: 'Thu Hà',
        status: 'ASSIGNED',
      },
      {
        id: 'staff-05',
        name: 'Vệ sinh ngăn tủ B02',
        reference: 'Tủ Vincom Thủ Đức',
        owner: 'Quang Huy',
        status: 'COMPLETED',
      },
      {
        id: 'staff-06',
        name: 'Bổ sung phụ kiện gói hoa',
        reference: 'Tủ Đại học FPT',
        owner: 'Thu Hà',
        status: 'IN_PROGRESS',
      },
    ],
  },
};

const recordSchema = z.object({
  name: z.string().trim().min(2, 'Nhập ít nhất 2 ký tự.').max(120, 'Tối đa 120 ký tự.'),
  reference: z.string().trim().min(2, 'Nhập ít nhất 2 ký tự.').max(120, 'Tối đa 120 ký tự.'),
  owner: z.string().trim().min(2, 'Nhập ít nhất 2 ký tự.').max(120, 'Tối đa 120 ký tự.'),
  status: z.string().min(1, 'Chọn trạng thái.'),
});

type RecordForm = z.infer<typeof recordSchema>;
type EditorState = { mode: 'create' } | { mode: 'edit'; record: ManagementRecord } | null;

const PAGE_SIZE = 4;

function statusLabel(config: RoleConfig, status: string) {
  return config.statuses.find((item) => item.value === status)?.label ?? status;
}

function RecordEditor({
  state,
  config,
  onClose,
  onSave,
}: {
  state: EditorState;
  config: RoleConfig;
  onClose: () => void;
  onSave: (values: RecordForm) => void;
}) {
  const editing = state?.mode === 'edit' ? state.record : null;
  const form = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      reference: '',
      owner: '',
      status: config.statuses[0].value,
    },
  });

  useEffect(() => {
    if (!state) return;
    form.reset(
      editing
        ? {
            name: editing.name,
            reference: editing.reference,
            owner: editing.owner,
            status: editing.status,
          }
        : { name: '', reference: '', owner: '', status: config.statuses[0].value },
    );
  }, [config.statuses, editing, form, state]);

  const field = (name: 'name' | 'reference' | 'owner', label: string, autoFocus = false) => {
    const error = form.formState.errors[name];
    return (
      <div className="management-field">
        <label htmlFor={`management-${name}`}>{label}</label>
        <input
          id={`management-${name}`}
          {...form.register(name)}
          readOnly={!config.detailsEditable}
          data-autofocus={autoFocus ? '' : undefined}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `management-${name}-error` : undefined}
        />
        {error && (
          <p id={`management-${name}-error`} className="management-field-error" role="alert">
            {error.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={state !== null}
      title={state?.mode === 'create' ? config.createLabel : `Cập nhật ${config.itemName}`}
      description={
        config.detailsEditable
          ? 'Các trường bắt buộc được kiểm tra ngay khi bạn rời ô nhập.'
          : 'Bạn chỉ có quyền cập nhật trạng thái của công việc này.'
      }
      onClose={onClose}
    >
      <form className="management-form" onSubmit={form.handleSubmit(onSave)} noValidate>
        {field('name', config.nameLabel, config.detailsEditable)}
        {field('reference', config.referenceLabel)}
        {field('owner', config.ownerLabel)}
        <div className="management-field">
          <label htmlFor="management-status">Trạng thái</label>
          <select
            id="management-status"
            {...form.register('status')}
            data-autofocus={!config.detailsEditable ? '' : undefined}
            aria-invalid={form.formState.errors.status ? 'true' : 'false'}
          >
            {config.statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <div className="management-modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit">Lưu thay đổi</Button>
        </div>
      </form>
    </Modal>
  );
}

function RecordDetails({
  record,
  config,
  onClose,
}: {
  record: ManagementRecord | null;
  config: RoleConfig;
  onClose: () => void;
}) {
  return (
    <Modal
      open={record !== null}
      title={`Chi tiết ${config.itemName}`}
      description="Thông tin đang hiển thị từ bộ dữ liệu minh họa cục bộ."
      onClose={onClose}
    >
      {record && (
        <>
          <dl className="management-details">
            <div>
              <dt>{config.nameLabel}</dt>
              <dd>{record.name}</dd>
            </div>
            <div>
              <dt>{config.referenceLabel}</dt>
              <dd>{record.reference}</dd>
            </div>
            <div>
              <dt>{config.ownerLabel}</dt>
              <dd>{record.owner}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{statusLabel(config, record.status)}</dd>
            </div>
          </dl>
          <div className="management-modal-actions">
            <Button type="button" onClick={onClose} data-autofocus>
              Đóng
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function DashboardManagement({ dashboardRole }: { dashboardRole: ManagementRole }) {
  const config = configs[dashboardRole];
  const [records, setRecords] = useState<ManagementRecord[]>(() => [...config.initialRecords]);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState>(null);
  const [viewing, setViewing] = useState<ManagementRecord | null>(null);
  const [disabling, setDisabling] = useState<ManagementRecord | null>(null);
  const nextId = useRef(config.initialRecords.length + 1);

  const rows = paginate(records, page, PAGE_SIZE);
  const activeCount = records.filter((record) => record.status === config.statuses[0].value).length;
  const attentionCount = records.filter(
    (record) => record.status === config.statuses[1].value,
  ).length;

  const columns = useMemo<readonly DataTableColumn<ManagementRecord>[]>(
    () => [
      {
        key: 'name',
        header: config.nameLabel,
        render: (record) => <strong>{record.name}</strong>,
      },
      {
        key: 'reference',
        header: config.referenceLabel,
        render: (record) => record.reference,
      },
      {
        key: 'owner',
        header: config.ownerLabel,
        render: (record) => record.owner,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (record) => (
          <span className="management-status" data-status={record.status}>
            {statusLabel(config, record.status)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Thao tác',
        className: 'management-actions-cell',
        render: (record) => (
          <div className="management-row-actions">
            <button type="button" onClick={() => setViewing(record)}>
              Xem
              <span className="sr-only"> {record.name}</span>
            </button>
            {config.detailsEditable && (
              <button type="button" onClick={() => setEditor({ mode: 'edit', record })}>
                Sửa
                <span className="sr-only"> {record.name}</span>
              </button>
            )}
            {config.canDisable && record.status !== config.inactiveStatus && (
              <button
                type="button"
                className="management-row-danger"
                onClick={() => setDisabling(record)}
              >
                Vô hiệu hóa
                <span className="sr-only"> {record.name}</span>
              </button>
            )}
          </div>
        ),
      },
    ],
    [config],
  );

  const saveRecord = (values: RecordForm) => {
    if (editor?.mode === 'edit') {
      setRecords((current) =>
        current.map((record) =>
          record.id === editor.record.id ? { ...record, ...values } : record,
        ),
      );
    } else {
      setRecords((current) => [
        { id: `${dashboardRole.toLowerCase()}-mock-${nextId.current++}`, ...values },
        ...current,
      ]);
      setPage(1);
    }
    setEditor(null);
  };

  const disableRecord = () => {
    if (!disabling || !config.inactiveStatus) return;
    setRecords((current) =>
      current.map((record) =>
        record.id === disabling.id ? { ...record, status: config.inactiveStatus! } : record,
      ),
    );
    setDisabling(null);
  };

  return (
    <section className="management-panel" aria-labelledby={`management-${dashboardRole}-title`}>
      <div className="management-heading">
        <div>
          <span className="preview-readonly-badge">Dữ liệu minh họa (Chỉ xem)</span>
          <p className="management-eyebrow" style={{ marginTop: '0.45rem' }}>
            {config.eyebrow}
          </p>
          <h2 id={`management-${dashboardRole}-title`}>{config.title}</h2>
          <p>{config.description}</p>
        </div>
        {config.canCreate && (
          <Button type="button" onClick={() => setEditor({ mode: 'create' })}>
            <Plus size={18} aria-hidden="true" />
            {config.createLabel}
          </Button>
        )}
      </div>

      <p className="management-demo-note" role="note">
        Dữ liệu minh họa — bảng mẫu ở chế độ chỉ xem (read-only preview), không hỗ trợ thao tác thêm
        hoặc chỉnh sửa.
      </p>

      <div
        className="management-stats"
        aria-label={`Thống kê ${config.title.toLocaleLowerCase('vi-VN')}`}
      >
        <article>
          <span>Tổng số</span>
          <strong>{records.length}</strong>
        </article>
        <article>
          <span>{config.statuses[0].label}</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <span>{config.statuses[1].label}</span>
          <strong>{attentionCount}</strong>
        </article>
      </div>

      <DataTable
        caption={config.title}
        columns={columns}
        rows={rows}
        getRowKey={(record) => record.id}
        emptyMessage={`Chưa có ${config.itemName} nào.`}
      />
      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={records.length}
        onPageChange={setPage}
      />

      <RecordEditor
        state={editor}
        config={config}
        onClose={() => setEditor(null)}
        onSave={saveRecord}
      />
      <RecordDetails record={viewing} config={config} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={disabling !== null}
        title={`Vô hiệu hóa ${config.itemName}?`}
        description={
          disabling
            ? `${disabling.name} vẫn được giữ trong bảng và chỉ chuyển sang trạng thái “${statusLabel(config, config.inactiveStatus ?? '')}”.`
            : ''
        }
        confirmLabel="Xác nhận vô hiệu hóa"
        onConfirm={disableRecord}
        onCancel={() => setDisabling(null)}
      />
    </section>
  );
}
