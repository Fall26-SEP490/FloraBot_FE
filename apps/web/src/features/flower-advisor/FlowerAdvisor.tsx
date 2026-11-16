'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from '@/shared/lib/api';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicKiosks } from '../kiosk-location/kiosk-location.api';
import './flower-advisor.css';

type Mode = 'WALK_IN' | 'PREORDER';
type Suggestion = {
  id: string;
  productId: string;
  kioskId: string;
  name: string;
  price: number;
  mode: Mode;
  reason: string;
  photo?: string | null;
  productRating?: number | null;
  productReviews?: number;
  shopRating?: number | null;
  shopReviews?: number;
  shopName?: string | null;
  kioskName?: string | null;
  distanceKm?: number | null;
};
type Answer = { message: string; suggestions: Suggestion[] };
type Exchange = { question: string; answer?: Answer; error?: boolean };

const prompts = {
  customer: [
    {
      question: 'Gợi ý bó hoa sinh nhật dưới 400.000 đ để lấy ngay.',
      mode: 'WALK_IN',
      budget: 400000,
    },
    { question: 'Tôi muốn đặt trước bó hoa tặng tốt nghiệp.', mode: 'PREORDER' },
    { question: 'Sắp có dịp gì để tặng hoa?' },
  ],
  seller: [
    { question: 'Tôi nên viết mô tả và gắn tag cho bó hoa như thế nào?' },
    { question: 'Tôi nên chuẩn bị mẫu hoa gì cho dịp sắp tới?' },
    { question: 'Tôi nên phân biệt mẫu bán tại tủ và mẫu đặt trước như thế nào?' },
  ],
} satisfies Record<string, { question: string; mode?: Mode; budget?: number }[]>;

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const distance = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export function FlowerAdvisor({ audience = 'customer' }: { audience?: 'customer' | 'seller' }) {
  const panel = useRef<HTMLDialogElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [kioskId, setKioskId] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number }>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const kiosks = useQuery({
    queryKey: ['public-kiosks'],
    queryFn: fetchPublicKiosks,
    enabled: opened && audience === 'customer',
  });
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  useEffect(() => {
    if (panel.current?.open) bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [exchanges]);

  async function send(input: { question: string; mode?: Mode; budget?: number }) {
    const text = input.question.trim();
    if (!text || sending.current) return;
    sending.current = true;
    setBusy(true);
    setQuestion('');
    setExchanges((previous) => [...previous.slice(-9), { question: text }]);
    try {
      const answer = await request<Answer>(
        '/shop/flower-chat',
        {
          ...input,
          question: text,
          kioskId: kioskId || undefined,
          ...(audience === 'customer' && input.mode !== 'WALK_IN' ? location : undefined),
        },
        false,
      );
      setExchanges((previous) => [...previous.slice(0, -1), { question: text, answer }]);
    } catch {
      setExchanges((previous) => [...previous.slice(0, -1), { question: text, error: true }]);
      setQuestion(text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({ question });
  }

  function locate() {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError(true);
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <>
      <button
        type="button"
        className="flower-advisor-launch"
        onClick={() => {
          setOpened(true);
          panel.current?.showModal();
        }}
      >
        Tư vấn FloraBot
      </button>
      <dialog ref={panel} aria-label="Tư vấn FloraBot" className="flower-advisor">
        <header>
          <strong>Tư vấn FloraBot</strong>
          <button type="button" onClick={() => panel.current?.close()} aria-label="Đóng tư vấn">
            ×
          </button>
        </header>
        {audience === 'customer' && (
          <div aria-label="Vị trí nhận hoa đặt trước">
            {location ? (
              <button type="button" onClick={() => setLocation(undefined)}>
                Bỏ vị trí của tôi
              </button>
            ) : (
              <button type="button" disabled={locating} onClick={locate}>
                {locating ? 'Đang lấy vị trí…' : 'Dùng vị trí của tôi'}
              </button>
            )}
            {locationError && (
              <p role="status">Chưa lấy được vị trí. Bạn vẫn có thể hỏi FloraBot.</p>
            )}
          </div>
        )}
        {audience === 'customer' && (
          <label>
            Kiosk mua tại tủ
            <select value={kioskId} onChange={(event) => setKioskId(event.target.value)}>
              <option value="">Chọn kiosk</option>
              {kiosks.data?.map((kiosk) => (
                <option key={kiosk.id} value={kiosk.id}>
                  {kiosk.name}
                </option>
              ))}
            </select>
            {kiosks.isError && (
              <button type="button" onClick={() => void kiosks.refetch()}>
                Tải lại kiosk
              </button>
            )}
          </label>
        )}
        <div className="flower-advisor-messages" role="log" aria-live="polite">
          <p>FloraBot xin chào, chúng tôi có thể giúp gì cho bạn ạ?</p>
          <div className="flower-advisor-prompts" aria-label="Câu hỏi gợi ý">
            {(prompts[audience] as { question: string; mode?: Mode; budget?: number }[]).map(
              (prompt) => (
                <button
                  key={prompt.question}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(prompt)}
                >
                  {prompt.question}
                </button>
              ),
            )}
          </div>
          {exchanges.map((exchange, index) => (
            <div key={index}>
              <p className="flower-advisor-question">{exchange.question}</p>
              {exchange.error && <p>FloraBot chưa trả lời được. Bạn thử gửi lại nhé.</p>}
              {exchange.answer && (
                <>
                  <p>{exchange.answer.message}</p>
                  {exchange.answer.suggestions?.map((item) => (
                    <article key={item.id}>
                      <strong>
                        <a
                          href={
                            item.mode === 'WALK_IN'
                              ? `/tim-kiosk?kiosk=${encodeURIComponent(item.kioskId)}`
                              : `/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}?zone=PREORDER`
                          }
                        >
                          {item.mode === 'PREORDER' && item.photo && (
                            <img
                              className="flower-advisor-photo"
                              src={item.photo}
                              alt=""
                              loading="lazy"
                            />
                          )}
                          {item.name}
                        </a>
                      </strong>
                      <span>
                        {currency.format(item.price)} ·{' '}
                        {item.mode === 'WALK_IN' ? 'Lấy tại tủ' : 'Đặt trước'}
                      </span>
                      {item.mode === 'PREORDER' && item.kioskName && (
                        <span>
                          {[
                            item.shopName,
                            item.kioskName,
                            item.distanceKm != null
                              ? `Cách khoảng ${distance.format(item.distanceKm)} km`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {item.productRating != null && (
                        <span>
                          Mẫu hoa {item.productRating}/5 ({item.productReviews} lượt)
                        </span>
                      )}
                      {item.shopRating != null && (
                        <span>
                          Shop {item.shopRating}/5 ({item.shopReviews} lượt)
                        </span>
                      )}
                      <p>{item.reason}</p>
                    </article>
                  ))}
                </>
              )}
            </div>
          ))}
          {busy && <p>FloraBot đang tìm gợi ý…</p>}
          <div ref={bottom} />
        </div>
        <form onSubmit={submit}>
          <input
            aria-label="Câu hỏi cho FloraBot"
            placeholder="Nhập câu hỏi…"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
          />
          <button type="submit" disabled={busy || !question.trim()}>
            Gửi
          </button>
        </form>
      </dialog>
    </>
  );
}
