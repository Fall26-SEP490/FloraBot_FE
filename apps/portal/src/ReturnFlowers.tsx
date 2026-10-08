import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import EvidenceUpload from './EvidenceUpload';
import { ApiError, queryClient, request } from './api';

export default function ReturnFlowers({
  slot,
  sellerId,
}: {
  slot: components['schemas']['SellerSlotResponse'];
  sellerId: string;
}) {
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState('');
  const [damaged, setDamaged] = useState(false);
  const [review, setReview] = useState(false);
  const [validation, setValidation] = useState('');
  const marker = `florabot:return-unconfirmed:${sellerId}:${slot.id}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(marker) === '1';
    } catch {
      return false;
    }
  });
  const sending = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  function mark(value: boolean) {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, '1');
      else sessionStorage.removeItem(marker);
    } catch {
      /* Keep the in-memory guard. */
    }
  }
  const mutation = useMutation({
    mutationFn: () =>
      request(`/sellers/${sellerId}/flows/return_to_seller`, {
        p_slot: slot.id,
        p_reason: reason.trim(),
        p_photo_url: photo,
        p_damaged: damaged,
      } satisfies components['schemas']['ReturnToSellerRequest']),
    onSuccess: () => {
      mark(false);
      setReview(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(error.status))
        mark(false);
      setReview(false);
    },
    onSettled: async () => {
      sending.current = false;
      await queryClient.invalidateQueries({ queryKey: ['seller-slots', sellerId] });
    },
  });
  if (
    !['PENDING_REMOVAL', 'PENDING_RELEASE'].includes(slot.status) &&
    !mutation.isSuccess &&
    !uncertain
  )
    return null;
  const id = `return-${slot.id}`;
  return (
    <div>
      <h4>Nhận lại hoa từ ô {slot.slotCode}</h4>
      {mutation.isSuccess ? (
        <p role="status">Đã ghi nhận trả hoa và cập nhật ô tủ.</p>
      ) : uncertain && !mutation.isPending ? (
        <div role="alert">
          <p>
            Chưa xác nhận được lần trả hoa trước. Kiểm tra ô và đối chiếu với đội ngũ trước khi gửi
            lại.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              mark(false);
              mutation.reset();
            }}
          >
            Đã đối chiếu với đội ngũ
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (sending.current) return;
            if (
              reason.trim().length < 5 ||
              reason.length > 2000 ||
              !photo.startsWith('evidence:v1:')
            ) {
              setValidation('Nhập lý do từ 5 đến 2.000 ký tự và tải ảnh minh chứng.');
              reasonRef.current?.focus();
              return;
            }
            setValidation('');
            if (!review) {
              setReview(true);
              requestAnimationFrame(() => confirmRef.current?.focus());
              return;
            }
            sending.current = true;
            mark(true);
            mutation.mutate();
          }}
        >
          <div hidden={review}>
            <label htmlFor={`${id}-reason`}>Lý do nhận lại hoa</label>
            <textarea
              ref={reasonRef}
              id={`${id}-reason`}
              value={reason}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={`${id}-error`}
            />
            <label className="payout-checkbox">
              <input
                type="checkbox"
                checked={damaged}
                onChange={(event) => setDamaged(event.target.checked)}
              />{' '}
              Hoa bị hư hỏng
            </label>
            <EvidenceUpload
              id={`${id}-photo`}
              endpoint={`/api/sellers/${sellerId}/slots/${slot.id}/evidence/return_to_seller`}
              onReference={setPhoto}
              disabled={mutation.isPending}
            />
          </div>
          {review && (
            <p>
              Chỉ xác nhận khi đã kiểm tra đúng ô {slot.slotCode} và nhận lại hoa. Hệ thống sẽ ghi
              nhận {damaged ? 'hoa hư hỏng' : 'trả hoa'} và cập nhật ô tủ.
            </p>
          )}
          <p id={`${id}-error`} role="alert" className="error">
            {validation || (mutation.error instanceof Error ? mutation.error.message : '')}
          </p>
          <Button ref={confirmRef} type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? 'Đang ghi nhận…'
              : review
                ? 'Xác nhận đã nhận lại hoa'
                : 'Kiểm tra thông tin trả hoa'}
          </Button>
          {review && (
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setReview(false)}
            >
              Sửa thông tin
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
