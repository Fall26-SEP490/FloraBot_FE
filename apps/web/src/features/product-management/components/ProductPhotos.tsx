'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Flower2, ImageIcon, Plus, RefreshCw } from '@florabot/ui';
import { ApiError, queryClient } from '@/shared/lib/api';
import { fetchProductPhotos } from '../product.api';
import type { PhotoPage, PhotoItem } from '../product.types';
import { safeImage } from '../product.utils';

const maximumBytes = 5 * 1024 * 1024;

function StoredPhoto({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return failed || !safeImage(url) ? (
    <div className="product-photo-fallback" title={`Không hiển thị được ${label}`}>
      <Flower2 size={20} aria-hidden="true" />
    </div>
  ) : (
    <img
      src={url}
      alt={label}
      width="96"
      height="96"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export default function ProductPhotos({
  sellerId,
  productId,
  productName,
  canEdit,
}: {
  sellerId: string;
  productId: string;
  productName: string;
  canEdit: boolean;
}) {
  const base = `/me/products/${productId}/photos`;
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const notice = useRef<HTMLParagraphElement>(null);
  const objectUrl = useRef('');
  const sending = useRef(false);

  const photos = useQuery<PhotoPage>({
    queryKey: ['product-photos', sellerId, productId, page],
    queryFn: () => fetchProductPhotos(productId, page),
    staleTime: 60_000,
  });

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      cameraStream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (!cameraOpen || !video.current || !cameraStream.current) return;
    video.current.srcObject = cameraStream.current;
    void video.current.play().catch(() => {
      setCameraError('Camera chưa phát được hình ảnh. Hãy đóng camera rồi thử lại.');
    });
  }, [cameraOpen]);

  function stopCamera() {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    if (video.current) video.current.srcObject = null;
    setCameraOpen(false);
    setCameraReady(false);
    setCameraStarting(false);
  }

  async function startCamera() {
    if (!canEdit || pending || uncertain || cameraStarting) return;
    setCameraError('');
    setCameraStarting(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt này không hỗ trợ chụp ảnh trực tiếp. Hãy chọn ảnh từ thiết bị.');
      setCameraStarting(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      cameraStream.current?.getTracks().forEach((track) => track.stop());
      cameraStream.current = stream;
      setCameraOpen(true);
    } catch (cause) {
      const denied = cause instanceof DOMException && cause.name === 'NotAllowedError';
      setCameraError(
        denied
          ? 'Bạn chưa cho phép sử dụng camera. Hãy cấp quyền camera cho trang rồi thử lại.'
          : 'Không mở được camera. Hãy kiểm tra camera hoặc chọn ảnh từ thiết bị.',
      );
    } finally {
      setCameraStarting(false);
    }
  }

  async function capturePhoto() {
    const source = video.current;
    if (!source || !cameraReady || source.videoWidth < 1 || source.videoHeight < 1) return;
    setCameraError('');
    const maximumEdge = 1920;
    const scale = Math.min(1, maximumEdge / Math.max(source.videoWidth, source.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(source.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Không xử lý được ảnh từ camera. Hãy chọn ảnh từ thiết bị.');
      return;
    }
    try {
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
    } catch {
      setCameraError('Camera chưa sẵn sàng để chụp. Hãy đợi hình ảnh hiển thị rồi thử lại.');
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88),
    );
    if (!blob) {
      setCameraError('Không tạo được ảnh chụp. Hãy thử lại hoặc chọn ảnh từ thiết bị.');
      return;
    }
    const captured = new File([blob], `hoa-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, {
      type: 'image/jpeg',
    });
    stopCamera();
    select(captured);
    setMessage('Đã chụp ảnh. Hãy kiểm tra ảnh xem trước trước khi tải lên.');
  }

  function select(value?: File) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = '';
    setPreview('');
    setFile(undefined);
    setError('');
    setMessage('');
    if (!value) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(value.type) ||
      value.size < 1 ||
      value.size > maximumBytes
    ) {
      setError('Chọn ảnh PNG, JPEG hoặc WebP, dung lượng tối đa 5 MB.');
      if (input.current) input.current.value = '';
      return;
    }
    objectUrl.current = URL.createObjectURL(value);
    setPreview(objectUrl.current);
    setFile(value);
  }

  async function upload() {
    if (!file || !canEdit || sending.current || uncertain) return;
    sending.current = true;
    setPending(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api${base}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new ApiError(
          response.status,
          problem.detail || 'Chưa tải được ảnh. Kiểm tra tệp và phiên đăng nhập rồi thử lại.',
        );
      }
      select();
      if (input.current) input.current.value = '';
      setMessage('Đã thêm ảnh cho sản phẩm.');
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['product-photos', sellerId, productId] });
    } catch (cause) {
      const rejected =
        cause instanceof ApiError &&
        [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(cause.status);
      setUncertain(!rejected);
      setError(
        rejected
          ? cause.message
          : 'Chưa xác định được ảnh đã lưu hay chưa. Làm mới danh sách ảnh và liên hệ đội ngũ kiểm tra trước khi tải lại.',
      );
    } finally {
      sending.current = false;
      setPending(false);
      notice.current?.focus();
    }
  }

  const items = photos.data?.items ?? [];

  return (
    <div className="product-photos-inline" aria-labelledby={`photos-title-${productId}`}>
      <div className="product-photos-header">
        <span id={`photos-title-${productId}`} className="product-photos-title">
          Hình ảnh mẫu hoa {photos.isSuccess ? `(${items.length})` : ''}
        </span>

        <div className="product-photo-source-actions">
          {canEdit && (
            <>
              <label
                className={`button button-outline product-photo-file-button${
                  !canEdit || pending || uncertain ? 'is-disabled' : ''
                }`}
              >
                <Plus size={13} aria-hidden="true" />
                <span>Chọn ảnh</span>
                <input
                  id={`photo-file-${productId}`}
                  ref={input}
                  className="product-photo-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={!canEdit || pending || uncertain}
                  aria-label={`Chọn ảnh cho ${productName}`}
                  aria-describedby={`photo-help-${productId} photo-notice-${productId}`}
                  onChange={(event) => {
                    stopCamera();
                    select(event.target.files?.[0]);
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={!canEdit || pending || uncertain || cameraStarting || cameraOpen}
                onClick={() => void startCamera()}
              >
                <ImageIcon size={13} aria-hidden="true" />
                <span>{cameraStarting ? 'Đang mở…' : 'Chụp ảnh'}</span>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={photos.isFetching || pending}
            onClick={() => void photos.refetch()}
            title="Làm mới danh sách ảnh"
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
              className={photos.isFetching ? 'is-spinning' : ''}
            />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {photos.isPending && (
        <p role="status" className="product-photos-status">
          Đang tải ảnh…
        </p>
      )}

      {photos.isError && (
        <p role="alert" className="error">
          Chưa tải được danh sách ảnh. Hãy bấm “Làm mới” để thử lại.
        </p>
      )}

      {photos.isSuccess && items.length === 0 && (
        <div className="product-photo-empty-inline">
          <span className="product-photo-default-badge" aria-hidden="true">
            <Flower2 size={18} />
          </span>
          <span>Chưa có ảnh riêng — đang hiển thị ảnh mặc định của hệ thống.</span>
        </div>
      )}

      {items.length > 0 && (
        <ul className="product-photo-gallery">
          {items.map((photo: PhotoItem, index: number) => (
            <li key={photo.id}>
              <StoredPhoto
                url={photo.url}
                label={`Ảnh ${(page - 1) * 20 + index + 1} của ${productName}`}
              />
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || photos.data?.hasMore) && (
        <div className="product-photo-pagination">
          <Button
            variant="outline"
            disabled={page === 1 || photos.isFetching || pending}
            onClick={() => setPage((value) => value - 1)}
          >
            Trang trước
          </Button>
          <span>Trang {page}</span>
          <Button
            variant="outline"
            disabled={!photos.data?.hasMore || photos.isError || photos.isFetching || pending}
            onClick={() => setPage((value) => value + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}

      {cameraOpen && (
        <div className="product-camera" aria-label={`Camera chụp ảnh cho ${productName}`}>
          <video
            ref={video}
            muted
            playsInline
            autoPlay
            aria-label={`Hình ảnh trực tiếp từ camera cho ${productName}`}
            onLoadedMetadata={() => setCameraReady(true)}
          />
          <div className="product-photo-source-actions">
            <Button type="button" disabled={!cameraReady} onClick={() => void capturePhoto()}>
              Chụp ảnh
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              Đóng camera
            </Button>
          </div>
        </div>
      )}

      {cameraError && (
        <p role="alert" className="error">
          {cameraError}
        </p>
      )}

      {preview && file && (
        <form
          className="product-photo-upload-bar"
          onSubmit={(event) => {
            event.preventDefault();
            void upload();
          }}
        >
          <figure className="product-photo-preview">
            <img
              src={preview}
              alt={`Xem trước ảnh đã chọn cho ${productName}`}
              width="56"
              height="56"
            />
            <figcaption>
              <strong>{file.name}</strong>
              <small id={`photo-help-${productId}`}>PNG, JPEG, WebP · Tối đa 5 MB</small>
            </figcaption>
          </figure>
          <div className="product-photo-upload-actions">
            <Button type="submit" disabled={!canEdit || pending || uncertain}>
              {pending ? 'Đang tải…' : 'Tải ảnh lên'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                select();
                if (input.current) input.current.value = '';
              }}
            >
              Hủy
            </Button>
          </div>
        </form>
      )}

      <p
        ref={notice}
        tabIndex={-1}
        id={`photo-notice-${productId}`}
        role={error ? 'alert' : 'status'}
        className={error ? 'error' : 'product-form-success'}
      >
        {error || message}
      </p>
    </div>
  );
}
