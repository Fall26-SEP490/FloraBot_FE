export function terminationNextStep(input: {
  status: string;
  removalTaskStatus?: string | null;
  archived: boolean;
  kioskStatus?: string;
}) {
  if (input.archived)
    return {
      owner: 'Hoàn tất',
      text: 'Tủ đã ngừng sử dụng và lưu trữ.',
      action: 'Xem hồ sơ',
      attention: false,
    };
  if (input.status === 'REQUESTED')
    return {
      owner: 'Manager',
      text: 'Xem xét yêu cầu chấm dứt thuê.',
      action: 'Xem xét yêu cầu',
      attention: true,
    };
  if (input.status === 'ACCEPTED') {
    if (!input.removalTaskStatus || input.removalTaskStatus === 'CANCELLED')
      return {
        owner: 'Manager',
        text: 'Giao kỹ thuật viên tháo dỡ kiosk.',
        action: 'Phân công tháo dỡ',
        attention: true,
      };
    if (input.removalTaskStatus === 'SUBMITTED')
      return {
        owner: 'Manager',
        text: 'Kiểm tra báo cáo và xác nhận bàn giao.',
        action: 'Nghiệm thu bàn giao',
        attention: true,
      };
    if (input.removalTaskStatus === 'ASSIGNED')
      return {
        owner: 'Kỹ thuật viên',
        text: 'Chờ kỹ thuật viên bắt đầu tháo dỡ.',
        action: 'Theo dõi công việc',
        attention: false,
      };
    if (input.removalTaskStatus === 'IN_PROGRESS')
      return {
        owner: 'Kỹ thuật viên',
        text: 'Đang tháo dỡ; chờ báo cáo kết quả.',
        action: 'Theo dõi công việc',
        attention: false,
      };
    return {
      owner: 'Manager',
      text: 'Kiểm tra trạng thái công việc và hồ sơ bàn giao.',
      action: 'Kiểm tra hồ sơ',
      attention: true,
    };
  }
  if (input.status === 'COMPLETED')
    return {
      owner: 'Manager',
      text:
        input.kioskStatus && input.kioskStatus !== 'OFFLINE'
          ? 'Tủ cần OFFLINE trước khi ngừng sử dụng và lưu trữ.'
          : 'Đã bàn giao; kiểm tra điều kiện lưu trữ tủ.',
      action: 'Kiểm tra lưu trữ',
      attention: true,
    };
  return {
    owner: 'Đã kết thúc yêu cầu',
    text: input.status === 'REJECTED' ? 'Yêu cầu đã bị từ chối.' : 'Shop đã rút yêu cầu.',
    action: 'Xem hồ sơ',
    attention: false,
  };
}
