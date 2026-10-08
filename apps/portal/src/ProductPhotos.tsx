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
  const base = `/sellers/${sellerId}/products/${productId}/photos`;
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
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
    },
    [],
  );
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
        <label htmlFor={`photo-file-${productId}`}>Chọn ảnh cho {productName}</label>
        <input
          id={`photo-file-${productId}`}
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={!canEdit || pending || uncertain}
          aria-describedby={`photo-help-${productId} photo-notice-${productId}`}
          onChange={(event) => select(event.target.files?.[0])}
        />
        <p id={`photo-help-${productId}`} className="quiet">
          PNG, JPEG hoặc WebP · Tối đa 5 MB mỗi ảnh.
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
