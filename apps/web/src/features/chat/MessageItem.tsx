import { Check, CheckCheck } from '@florabot/ui';
import type { CustomerSellerChatMessage } from './types';
import { ChatImage } from './ChatImage';

export function MessageItem({ message }: { message: CustomerSellerChatMessage }) {
  const isMine = message.isMine;
  const createdAtDate = new Date(message.createdAt);
  const timeFormatted = isNaN(createdAtDate.getTime())
    ? ''
    : createdAtDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

  const fullDateFormatted = isNaN(createdAtDate.getTime())
    ? ''
    : createdAtDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

  const readAtFormatted = message.readAt
    ? new Date(message.readAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <li
      className={`chat-message-row ${isMine ? 'is-mine' : 'is-counterparty'}`}
      data-message-id={message.id}
    >
      {!isMine && (
        <span className="chat-message-avatar" aria-hidden="true">
          {(message.senderName?.trim().charAt(0) || '?').toLocaleUpperCase('vi-VN')}
        </span>
      )}
      <div className="chat-message-bubble">
        {!isMine && (
          <span className="chat-message-sender" aria-label={`Người gửi: ${message.senderName}`}>
            {message.senderName}
          </span>
        )}

        {message.imageUrl && (
          <div className="chat-message-media">
            <ChatImage
              src={message.imageUrl}
              alt={`Ảnh gửi bởi ${isMine ? 'bạn' : message.senderName}`}
            />
          </div>
        )}

        {message.content && <p className="chat-message-text">{message.content}</p>}

        <div className="chat-message-meta">
          <time dateTime={message.createdAt} title={`${fullDateFormatted} ${timeFormatted}`}>
            {timeFormatted}
          </time>

          {isMine && (
            <span
              className={`chat-message-status ${message.readAt ? 'is-read' : 'is-sent'}`}
              title={message.readAt ? `Đã xem lúc ${readAtFormatted}` : 'Đã gửi'}
            >
              {message.readAt ? (
                <>
                  <CheckCheck size={14} aria-hidden="true" />
                  <span className="chat-read-label">Đã xem</span>
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden="true" />
                  <span className="chat-sent-label">Đã gửi</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
