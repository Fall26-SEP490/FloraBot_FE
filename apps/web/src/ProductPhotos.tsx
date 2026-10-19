import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, request } from './api';

type PhotoPage = components['schemas']['ProductPhotoPage'];
const maximumBytes = 5 * 1024 * 1024;
function safeImage(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
function StoredPhoto({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return failed || !safeImage(url) ? (
    <p>Không hiển thị được {label.toLocaleLowerCase('vi')}.</p>
  ) : (
    <img
      src={url}
      alt={label}
      width="240"
      height="180"
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
  const [loaded, setLoaded] = useState(false);
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
  const photos = useQuery({
    queryKey: ['product-photos', sellerId, productId, page],
    queryFn: () => request<PhotoPage>(`${base}?page=${page}`),
    enabled: loaded,
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
      // Raw bytes match the image endpoint; never replay a possibly committed upload automatically.
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
      setLoaded(true);
      setPage(1);
      if (page === 1 && loaded) await photos.refetch();
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
      setLoaded(true);
    } finally {
      sending.current = false;
      setPending(false);
      notice.current?.focus();
    }
  }
  return (
    <section className="product-photos" aria-labelledby={`photos-title-${productId}`}>
      <h3 id={`photos-title-${productId}`}>Để bó hoa lên hình thật xinh</h3>
      <p>
        Thêm ảnh rõ nét của {productName}. Ảnh sản phẩm được lưu công khai; không tải chứng từ hay
        thông tin cá nhân tại đây.
      </p>
      <Button
        variant="outline"
        disabled={photos.isFetching || pending}
        onClick={() => {
          if (loaded) void photos.refetch();
          else setLoaded(true);
        }}
      >
        {loaded ? 'Làm mới danh sách ảnh' : 'Xem ảnh sản phẩm'}
      </Button>
      {photos.isFetching && <p role="status">Đang tải danh sách ảnh…</p>}
      {photos.isError && (
        <p role="alert" className="error">
          Chưa tải được danh sách ảnh. Bạn chọn “Làm mới danh sách ảnh” để thử lại.
        </p>
      )}
      {loaded && photos.data?.items.length === 0 && <p>Chưa có ảnh trên trang này.</p>}
      <ul className="product-photo-gallery">
        {photos.data?.items.map((photo, index) => (
          <li key={photo.id}>
            <StoredPhoto
              url={photo.url}
              label={`Ảnh ${(page - 1) * 20 + index + 1} của ${productName}`}
            />
          </li>
        ))}
      </ul>
      {loaded && (page > 1 || photos.data?.hasMore) && (
        <div className="stock-actions">
          <Button
            variant="outline"
            disabled={page === 1 || photos.isFetching || pending}
            onClick={() => setPage((value) => value - 1)}
          >
            Trang ảnh trước
          </Button>
          <span>Trang {page}</span>
          <Button
            variant="outline"
            disabled={!photos.data?.hasMore || photos.isError || photos.isFetching || pending}
            onClick={() => setPage((value) => value + 1)}
          >
            Trang ảnh sau
          </Button>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void upload();
        }}
      >
        <label htmlFor={`photo-file-${productId}`}>Ảnh cho {productName}</label>
        <div className="product-photo-source-actions">
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || pending || uncertain || cameraStarting || cameraOpen}
            onClick={() => void startCamera()}
          >
            {cameraStarting ? 'Đang mở camera…' : 'Chụp ảnh bằng camera'}
          </Button>
          <span aria-hidden="true">hoặc</span>
          <label
            className={`button button-outline product-photo-file-button${
              !canEdit || pending || uncertain ? 'is-disabled' : ''
            }`}
          >
            Chọn ảnh từ thiết bị
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
        </div>
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
        <p id={`photo-help-${productId}`} className="quiet">
          Chụp trực tiếp hoặc chọn PNG, JPEG, WebP từ thiết bị · Tối đa 5 MB mỗi ảnh.
        </p>
        {preview && (
          <figure className="product-photo-preview">
            <img
              src={preview}
              alt={`Xem trước ảnh đã chọn cho ${productName}`}
              width="320"
              height="240"
            />
            <figcaption>{file?.name}</figcaption>
          </figure>
        )}
        <Button type="submit" disabled={!canEdit || !file || pending || uncertain}>
          {pending ? 'Đang tải và kiểm tra ảnh…' : 'Tải ảnh sản phẩm'}
        </Button>
        <p
          ref={notice}
          tabIndex={-1}
          id={`photo-notice-${productId}`}
          role={error ? 'alert' : 'status'}
          className={error ? 'error' : undefined}
        >
          {error || message}
        </p>
      </form>
    </section>
  );
}
