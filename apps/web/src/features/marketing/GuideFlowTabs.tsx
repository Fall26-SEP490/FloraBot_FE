'use client';

import { useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { ClipboardList, Package, Send, ShieldCheck, Unlock, Wallet } from '@florabot/ui';

type FlowId = 'available' | 'custom';

type Flow = {
  id: FlowId;
  label: string;
  description: string;
  steps: Array<{
    title: string;
    description: string;
    icon: ComponentType<{
      size?: number;
      className?: string;
      'aria-hidden'?: boolean | 'true' | 'false';
    }>;
  }>;
};

const flows: Flow[] = [
  {
    id: 'available',
    label: 'Mua có sẵn',
    description: 'Chọn hoa, thanh toán và nhận ngay tại kiosk.',
    steps: [
      {
        title: 'Chọn hoa tại kiosk',
        description: 'Chọn bó hoa đang có sẵn trên màn hình kiosk.',
        icon: Package,
      },
      {
        title: 'Thanh toán bằng VietQR',
        description: 'Kiểm tra đơn và quét mã bằng ứng dụng ngân hàng.',
        icon: ShieldCheck,
      },
      {
        title: 'Mở tủ & nhận hoa',
        description: 'Khi hệ thống ghi nhận thanh toán, chờ ô mở rồi lấy hoa.',
        icon: Unlock,
      },
    ],
  },
  {
    id: 'custom',
    label: 'Đặt mẫu riêng',
    description: 'Bốn bước đặt thiết kế riêng, có báo giá và lịch hẹn rõ ràng từ shop.',
    steps: [
      {
        title: 'Gửi yêu cầu',
        description: 'Chọn shop, kiosk và mô tả mẫu hoa theo ngân sách.',
        icon: Send,
      },
      {
        title: 'Duyệt báo giá',
        description: 'Xem giá trọn gói và lịch hoàn thành do shop đề xuất.',
        icon: ClipboardList,
      },
      {
        title: 'Thanh toán & chuẩn bị',
        description: 'Thanh toán theo báo giá. Khi hệ thống ghi nhận, shop sẽ chuẩn bị hoa.',
        icon: Wallet,
      },
      {
        title: 'Nhận hoa tại kiosk',
        description: 'Đến đúng tủ và nhập mã nhận hoa 8 số được gửi qua email.',
        icon: Unlock,
      },
    ],
  },
];

export default function GuideFlowTabs() {
  const [activeFlow, setActiveFlow] = useState<FlowId>('available');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: number) {
    const nextFlow = flows[index];
    if (!nextFlow) return;
    setActiveFlow(nextFlow.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % flows.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + flows.length) % flows.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = flows.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  return (
    <section className="guide-process-section" aria-labelledby="steps-heading">
      <div className="guide-process-header">
        <div className="guide-process-heading-wrap">
          <h2 id="steps-heading">Quy trình đặt & nhận hoa</h2>
          <p>Chọn đúng hình thức mua để xem các bước tương ứng.</p>
        </div>

        <div className="guide-tabs" role="tablist" aria-label="Chọn quy trình mua hoa">
          {flows.map((flow, index) => {
            const selected = activeFlow === flow.id;
            return (
              <button
                key={flow.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`guide-tab-${flow.id}`}
                className="guide-tab"
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`guide-panel-${flow.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveFlow(flow.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {flow.label}
              </button>
            );
          })}
        </div>
      </div>

      {flows.map((flow) => {
        const selected = activeFlow === flow.id;
        return (
          <div
            key={flow.id}
            id={`guide-panel-${flow.id}`}
            className="guide-flow-panel"
            role="tabpanel"
            aria-labelledby={`guide-tab-${flow.id}`}
            hidden={!selected}
          >
            <p className="guide-process-desc">{flow.description}</p>
            <ol className="guide-steps-grid">
              {flow.steps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <li className="guide-step-card" key={step.title}>
                    <span className="guide-step-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="guide-step-icon-badge" aria-hidden="true">
                      <StepIcon size={20} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
