import { useEffect, useRef, useState } from 'react';
import { Button, ImageIcon, Send, X } from '@florabot/ui';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_MESSAGE_LENGTH,
  formatChatError,
  customerChatTransport,
  validateChatImageFile,
} from './api';
import type { ChatTransport, CustomerSellerChatMessage } from './types';

const GATEWAY_SAFE_IMAGE_BYTES = 58 * 1024;

async function compressChatImageIfNeeded(file: File): Promise<File> {
  if (file.size <= GATEWAY_SAFE_IMAGE_BYTES || typeof document === 'undefined') {
    return file;
  }
  try {
    const bitmap = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : null;
    if (!bitmap) return file;

    const maxDim = 960;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    for (const quality of [0.8, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob && blob.size > 0 && blob.size < file.size) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'chat-image';
        const candidate = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
        if (candidate.size <= GATEWAY_SAFE_IMAGE_BYTES || quality === 0.5) {
          return candidate;
        }
      }
    }
  } catch {
    /* Fall back to original file if canvas compression is unavailable */
  }
  return file;
}

export function MessageComposer({
  chatId,
  onMessageSent,
  disabled = false,
  transport = customerChatTransport,
}: {
  chatId: string;
  onMessageSent: (message: CustomerSellerChatMessage) => void;
  disabled?: boolean;
  transport?: ChatTransport;
}) {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedRef, setUploadedRef] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendStep, setSendStep] = useState<'' | 'uploading' | 'sending'>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingLock = useRef(false);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationErr = validateChatImageFile(file);
    if (validationErr) {
      setError(validationErr);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setUploadedRef(null);
      setPreviewUrl(null);
      return;
    }

    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setUploadedRef(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setUploadedRef(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
    textareaRef.current?.focus();
  };

  const handleBlur = () => {
    if (!content.trim() && !selectedFile) return;
    const validationErr = transport.validate(content, Boolean(selectedFile));
    if (validationErr) {
      setError(validationErr);
    } else {
      setError(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (disabled || isSending || sendingLock.current) return;

    const trimmed = content.trim();
    const validationErr = transport.validate(trimmed, Boolean(selectedFile));
    if (validationErr) {
      setError(validationErr);
      textareaRef.current?.focus();
      return;
    }

    setError(null);
    setIsSending(true);
    sendingLock.current = true;

    try {
      let imageReference: string | null = uploadedRef;

      if (selectedFile && !imageReference) {
        setSendStep('uploading');
        const preparedFile = await compressChatImageIfNeeded(selectedFile);
        const uploadResult = await transport.upload(chatId, preparedFile);
        imageReference = uploadResult.reference;
        setUploadedRef(imageReference);
      }

      setSendStep('sending');
      const sent = await transport.send(chatId, {
        content: trimmed || null,
        imageReference,
      });

      // Clear input on success
      setContent('');
      setSelectedFile(null);
      setUploadedRef(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(null);
      onMessageSent(sent);
      textareaRef.current?.focus();
    } catch (cause) {
      setError(formatChatError(cause));
    } finally {
      setIsSending(false);
      setSendStep('');
      sendingLock.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount >= 1700;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  const fileSizeFormatted = selectedFile
    ? selectedFile.size > 1024 * 1024
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(selectedFile.size / 1024)} KB`
    : '';

  return (
    <form className="chat-composer" onSubmit={(e) => void handleSubmit(e)}>
      {selectedFile && previewUrl && (
        <div className="chat-composer-preview">
          <img src={previewUrl} alt="Ảnh đã chọn đính kèm" className="chat-composer-thumbnail" />
          <div className="chat-composer-preview-info">
            <span className="chat-composer-filename">{selectedFile.name}</span>
            <span className="chat-composer-filesize">{fileSizeFormatted}</span>
          </div>
          <button
            type="button"
            className="chat-composer-remove-btn"
            onClick={handleRemoveImage}
            disabled={isSending}
            aria-label="Bỏ ảnh đã chọn"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <p className="chat-composer-error" role="alert">
          {error}
        </p>
      )}

      <div className="chat-composer-controls">
        <input
          ref={fileInputRef}
          type="file"
          id={`chat-file-input-${chatId}`}
          className="chat-composer-file-input"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={disabled || isSending}
          aria-label="Đính kèm ảnh"
        />
        <button
          type="button"
          className="chat-composer-image-btn"
          disabled={disabled || isSending}
          onClick={() => fileInputRef.current?.click()}
          title="Chọn ảnh (tối đa 5 MB: PNG, JPEG, WebP)"
          aria-label="Chọn ảnh đính kèm"
        >
          <ImageIcon size={20} aria-hidden="true" />
        </button>

        <div className="chat-composer-input-wrapper">
          <label htmlFor={`chat-textarea-${chatId}`} className="sr-only">
            Nội dung tin nhắn
          </label>
          <textarea
            ref={textareaRef}
            id={`chat-textarea-${chatId}`}
            className="chat-composer-textarea"
            placeholder="Nhập tin nhắn..."
            rows={1}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            aria-invalid={Boolean(error || isOverLimit)}
          />

          <div
            className={`chat-composer-counter ${isNearLimit ? 'is-warning' : ''} ${
              isOverLimit ? 'is-error' : ''
            }`}
            aria-live="polite"
          >
            {charCount > 0 && `${charCount}/${MAX_MESSAGE_LENGTH}`}
          </div>
        </div>

        <Button
          type="submit"
          className="chat-composer-submit-btn"
          disabled={disabled || isSending || (!content.trim() && !selectedFile) || isOverLimit}
        >
          <Send size={18} aria-hidden="true" />
          <span>
            {sendStep === 'uploading'
              ? 'Đang tải ảnh…'
              : sendStep === 'sending'
                ? 'Đang gửi…'
                : 'Gửi'}
          </span>
        </Button>
      </div>
    </form>
  );
}
