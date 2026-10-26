import { useState } from 'react';
import { Button } from '@florabot/ui';
import {
  clearReceipts,
  readReceipts,
  receiptLink,
  removeReceipt,
  type SavedReceipt,
} from './guestReceipts';
import './portal.css';
import './receipt.css';

export default function GuestHistory() {
  const [state, setState] = useState<{ items: SavedReceipt[]; error: string }>(() => {
    try {
      return { items: readReceipts(), error: '' };
    } catch {
      return {
        items: [],
        error:
          'Chưa đọc được biên nhận đã lưu trên thiết bị. Bạn vẫn có thể tra cứu bằng mã riêng.',
      };
    }
  });
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  function remove(id?: string) {
    try {
      if (id) removeReceipt(id);
      else clearReceipts();
      setState({ items: readReceipts(), error: '' });
      setNotice(id ? 'Đã xóa biên nhận khỏi thiết bị này.' : 'Đã xóa danh sách trên thiết bị này.');
      setConfirmClear(false);
    } catch {
      setState((current) => ({
        ...current,
        error: 'Không thay đổi được bộ nhớ thiết bị. Kiểm tra quyền lưu trữ và thử lại.',
      }));
    }
  }
  return (
    <main id="main" className="receipt-page">
      <a className="portal-brand" href="/">
        FloraBot
      </a>
      <h1>Biên nhận đã lưu</h1>
      <p>Những lần mua hoa bạn đã chọn lưu trên trình duyệt này, không cần tài khoản.</p>
      <p>
        Người dùng chung thiết bị có thể mở các biên nhận này. Xóa danh sách chỉ xóa bản lưu tại
        đây; giao dịch trong hệ thống vẫn được giữ.
      </p>
      <a href="/receipt">Tra cứu bằng mã biên nhận</a>
      {state.error && <p role="alert">{state.error}</p>}
      {notice && <p role="status">{notice}</p>}
      {state.items.length === 0 && !state.error ? (
        <p>
          Chưa có biên nhận đã lưu. Quét QR tại tủ bằng điện thoại, xem biên nhận và chọn lưu sau
          khi nhận hoa thành công.
        </p>
      ) : (
        <ul className="receipt-items">
          {state.items.map((item) => (
            <li key={item.orderId}>
              <a href={receiptLink(item)} referrerPolicy="no-referrer">
                Xem đơn {item.orderCode}
              </a>
              <span>Lưu ngày {new Date(item.savedAt).toLocaleDateString('vi-VN')}</span>
              <Button
                variant="outline"
                aria-label={`Xóa bản lưu đơn ${item.orderCode}`}
                onClick={() => remove(item.orderId)}
              >
                Xóa bản lưu
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(state.items.length > 0 || state.error) &&
        (confirmClear ? (
          <div>
            <p>Xóa toàn bộ biên nhận đã lưu trên thiết bị này?</p>
            <Button onClick={() => remove()}>Xác nhận xóa danh sách</Button>{' '}
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Giữ lại
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirmClear(true)}>
            Xóa tất cả bản lưu
          </Button>
        ))}
    </main>
  );
}
