'use client';

import { useEffect, useRef, useState } from 'react';
import { Flower2, Plus, X } from '@florabot/ui';
import type { CustomerSellerChatItem } from './types';

interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

export function ChatCustomerDetails({
  chat,
  onClose,
}: {
  chat: CustomerSellerChatItem;
  onClose?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        event.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const storageKey = `florabot_chat_notes_${chat.id}`;
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is NoteItem =>
              item &&
              typeof item.id === 'string' &&
              typeof item.text === 'string' &&
              typeof item.createdAt === 'string',
          )
        : [];
    } catch {
      return [];
    }
  });
  const [newNote, setNewNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [noteNotice, setNoteNotice] = useState('');

  const handleAddNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    const note: NoteItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      createdAt: new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }),
    };
    const updated = [note, ...notes];
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setNotes(updated);
      setNewNote('');
      setNoteError('');
      setNoteNotice('Đã lưu ghi chú trên trình duyệt này.');
    } catch {
      setNoteNotice('');
      setNoteError(
        'Chưa lưu được trên trình duyệt. Nội dung vẫn được giữ để bạn sao chép hoặc thử lại.',
      );
    }
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setNotes(updated);
      setNoteError('');
      setNoteNotice('Đã xóa ghi chú trên trình duyệt này.');
    } catch {
      setNoteNotice('');
      setNoteError('Chưa xóa được ghi chú khỏi trình duyệt. Bạn có thể thử lại.');
    }
  };

  const firstLetter = chat.otherPartyName.slice(0, 1).toLocaleUpperCase('vi-VN') || 'K';
  const createdDate = new Date(chat.createdAt).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <aside className="chat-details-panel" aria-label="Thông tin chi tiết khách hàng">
      <div className="chat-details-header">
        <h3>Thông tin khách hàng</h3>
        {onClose && (
          <button
            type="button"
            ref={closeRef}
            className="chat-details-close-btn"
            onClick={onClose}
            aria-label="Thu gọn bảng thông tin"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="chat-details-scroll">
        <div className="chat-details-profile">
          <div className="chat-details-avatar" aria-hidden="true">
            {firstLetter}
          </div>
          <h4 className="chat-details-name">{chat.otherPartyName}</h4>
          <div className="chat-details-profile-tags">
            <span className="chat-details-date">Bắt đầu: {createdDate}</span>
          </div>
        </div>

        {chat.productContext && (
          <section className="chat-details-section">
            <h5 className="chat-details-section-title">Mẫu hoa đang trao đổi</h5>
            <div className="chat-details-product-card">
              <span className="chat-details-product-icon" aria-hidden="true">
                <Flower2 size={18} />
              </span>
              <div className="chat-details-product-info">
                <strong>{chat.productContext}</strong>
                <small>Khách gửi tin từ gian hàng</small>
              </div>
            </div>
          </section>
        )}

        <section className="chat-details-section chat-details-notes-section">
          <div className="chat-details-section-header">
            <h5 className="chat-details-section-title">Ghi chú trên trình duyệt</h5>
            <span className="chat-details-section-hint">Không gửi cho khách</span>
          </div>

          <p className="chat-note-storage-help">
            Ghi chú chỉ lưu trên trình duyệt này, chưa đồng bộ với tài khoản hoặc thiết bị khác.
          </p>
          <div className="chat-note-input-box">
            <textarea
              aria-label="Ghi chú khách hàng trên trình duyệt"
              maxLength={2000}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Thêm ghi chú khách hàng..."
              rows={2}
            />
            <button
              type="button"
              className="chat-note-add-btn"
              onClick={handleAddNote}
              disabled={!newNote.trim()}
            >
              <Plus size={13} aria-hidden="true" />
              Lưu ghi chú
            </button>
          </div>

          {noteError && <p role="alert">{noteError}</p>}
          <p role="status">{noteNotice}</p>
          <div className="chat-notes-list">
            {notes.length === 0 ? (
              <p className="chat-notes-empty">Chưa có ghi chú nào cho khách hàng này.</p>
            ) : (
              notes.map((item) => (
                <div key={item.id} className="chat-note-card">
                  <div className="chat-note-header">
                    <small>{item.createdAt}</small>
                    <button
                      type="button"
                      className="chat-note-delete-btn"
                      onClick={() => handleDeleteNote(item.id)}
                      title="Xóa ghi chú"
                      aria-label="Xóa ghi chú"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <p>{item.text}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
