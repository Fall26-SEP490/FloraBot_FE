import { Button } from '@florabot/ui';
import { Modal } from '@/shared/components/Modal';

export type ChatNotice =
  { kind: 'login'; returnUrl: string } | { kind: 'role' } | { kind: 'error'; message: string };

export function ChatNoticeDialog({
  notice,
  onClose,
  onLogin,
}: {
  notice: ChatNotice | null;
  onClose: () => void;
  onLogin: (returnUrl: string) => void;
}) {
  const title =
    notice?.kind === 'login'
      ? 'Đăng nhập để nhắn tin'
      : notice?.kind === 'role'
        ? 'Không thể nhắn tin bằng tài khoản này'
        : 'Chưa mở được chat';
  const description =
    notice?.kind === 'login'
      ? 'Bạn cần đăng nhập bằng tài khoản khách hàng để trao đổi với shop.'
      : notice?.kind === 'role'
        ? 'Chỉ tài khoản khách hàng thành viên mới có thể nhắn tin với shop.'
        : notice?.kind === 'error'
          ? notice.message
          : undefined;

  return (
    <Modal
      open={notice !== null}
      title={title}
      description={description}
      onClose={onClose}
      size="sm"
    >
      <div className="catalog-chat-notice-actions">
        <Button
          variant={notice?.kind === 'login' ? 'outline' : 'default'}
          data-autofocus
          onClick={onClose}
        >
          {notice?.kind === 'login' ? 'Để sau' : 'Đóng'}
        </Button>
        {notice?.kind === 'login' && (
          <Button onClick={() => onLogin(notice.returnUrl)}>Đăng nhập</Button>
        )}
      </div>
    </Modal>
  );
}
