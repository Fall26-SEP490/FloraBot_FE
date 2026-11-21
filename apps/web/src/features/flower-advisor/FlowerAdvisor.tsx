'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Flower2,
  MapPin,
  MessageSquare,
  Navigation,
  Send,
} from '@florabot/ui';
import Link from 'next/link';
import { ApiError, request } from '@/shared/lib/api';
import { Modal } from '@/shared/components/Modal';
import { fetchPublicKiosks } from '../kiosk-location/kiosk-location.api';
import { FlowerAdvisorSuggestion } from './FlowerAdvisorSuggestion';
import { FlowerAdvisorKioskPicker } from './FlowerAdvisorKioskPicker';
import { FlowerAdvisorKioskCards } from './FlowerAdvisorKioskCards';
import { flowerChatMode } from './flower-advisor.utils';
import type { FlowerChatAnswer, FlowerChatInput, FlowerChatPrompt } from './flower-advisor.types';
import './flower-advisor.css';

type Exchange = { id: number; input: FlowerChatPrompt; answer?: FlowerChatAnswer; error?: string };
type Prompt = FlowerChatPrompt & { label: string };

const prompts: Record<'customer' | 'seller', Prompt[]> = {
  customer: [
    { label: 'Tìm kiosk gần tôi', question: 'Kiosk nào gần tôi nhất?', mode: 'PREORDER' },
    {
      label: 'Shop bán nhiều đơn',
      question: 'Shop nào bán được nhiều đơn đặt trước nhất?',
      mode: 'PREORDER',
    },
    {
      label: 'Gợi ý hoa đặt trước',
      question: 'Gợi ý hoa sinh nhật đặt trước dưới 400.000đ.',
      mode: 'PREORDER',
      budget: 400000,
    },
  ],
  seller: [
    {
      label: 'Viết mô tả và gắn tag',
      question: 'Tôi nên viết mô tả và gắn tag cho bó hoa như thế nào?',
    },
    { label: 'Chuẩn bị mẫu hoa', question: 'Tôi nên chuẩn bị mẫu hoa gì cho dịp sắp tới?' },
    {
      label: 'Bán sẵn và đặt trước',
      question: 'Tôi nên phân biệt mẫu bán tại tủ và mẫu đặt trước như thế nào?',
    },
  ],
};

export function FlowerAdvisor({ audience = 'customer' }: { audience?: 'customer' | 'seller' }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closingRef = useRef(false);
  const resizeFrame = useRef<number | undefined>(undefined);
  const resizeAnimation = useRef<Animation | undefined>(undefined);
  const messages = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const kioskTrigger = useRef<HTMLButtonElement>(null);
  const chatScrollTop = useRef(0);
  const sending = useRef(false);
  const nextId = useRef(0);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [kioskId, setKioskId] = useState('');
  const [choosingKiosk, setChoosingKiosk] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number }>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [viewport, setViewport] = useState<{ height: number; top: number }>();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const kiosks = useQuery({
    queryKey: ['public-kiosks'],
    queryFn: fetchPublicKiosks,
    enabled: opened && audience === 'customer',
  });

  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
      if (resizeFrame.current !== undefined) cancelAnimationFrame(resizeFrame.current);
      resizeAnimation.current?.cancel();
    },
    [],
  );

  function finishClose() {
    clearTimeout(closeTimer.current);
    closingRef.current = false;
    setOpened(false);
    setClosing(false);
    setExpanded(false);
    setChoosingKiosk(false);
  }

  function close() {
    if (closingRef.current) return;
    if (resizeFrame.current !== undefined) cancelAnimationFrame(resizeFrame.current);
    resizeAnimation.current?.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    // Keep focus trapping and scroll locking until exit finishes. The fallback
    // also releases the modal if an animation is cancelled or CSS is unavailable.
    closeTimer.current = setTimeout(finishClose, 250);
  }

  function toggleExpanded() {
    if (closingRef.current) return;
    const panel = root.current?.querySelector<HTMLElement>('.flower-advisor');
    const before = panel?.getBoundingClientRect();
    if (resizeFrame.current !== undefined) cancelAnimationFrame(resizeFrame.current);
    resizeAnimation.current?.cancel();
    setExpanded((value) => !value);
    if (!panel || !before || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    resizeFrame.current = requestAnimationFrame(() => {
      const after = panel.getBoundingClientRect();
      // FLIP changes layout once; only transform animates between the two sizes.
      resizeAnimation.current = panel.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${before.x - after.x}px, ${before.y - after.y}px) scale(${before.width / after.width}, ${before.height / after.height})`,
          },
          { transformOrigin: 'top left', transform: 'none' },
        ],
        { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
    });
  }

  useEffect(() => {
    if (!choosingKiosk) {
      kioskTrigger.current?.focus({ preventScroll: true });
      if (messages.current) messages.current.scrollTop = chatScrollTop.current;
    }
  }, [choosingKiosk]);

  useEffect(() => {
    if (!opened) return;
    const view = window.visualViewport;
    if (!view) return;
    const update = () => setViewport({ height: view.height, top: view.offsetTop });
    update();
    view.addEventListener('resize', update);
    view.addEventListener('scroll', update);
    return () => {
      view.removeEventListener('resize', update);
      view.removeEventListener('scroll', update);
    };
  }, [opened]);

  useEffect(() => {
    if (opened && messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, [exchanges, busy, opened]);

  useEffect(() => {
    const input = composer.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  }, [question, opened, choosingKiosk]);

  async function send(input: FlowerChatPrompt, retryId?: number, origin = location) {
    const text = input.question.trim();
    if (!text || text.length > 500 || sending.current || closingRef.current) return;
    const prompt = { ...input, question: text };
    const exchangeId = retryId ?? ++nextId.current;
    sending.current = true;
    setBusy(true);
    setQuestion((draft) => (draft.trim() === text ? '' : draft));
    setExchanges((previous) =>
      retryId == null
        ? [...previous.slice(-9), { id: exchangeId, input: prompt }]
        : previous.map((item) =>
            item.id === exchangeId ? { id: exchangeId, input: prompt } : item,
          ),
    );
    try {
      const mode = flowerChatMode(prompt);
      const payload: FlowerChatInput = {
        ...prompt,
        ...(audience === 'customer'
          ? {
              mode,
              kioskId: mode === 'WALK_IN' ? kioskId || undefined : undefined,
              ...(mode === 'PREORDER' ? origin : undefined),
            }
          : {}),
      };
      const answer = await request<FlowerChatAnswer>('/shop/flower-chat', payload);
      setExchanges((previous) =>
        previous.map((item) => (item.id === exchangeId ? { ...item, answer } : item)),
      );
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 429
          ? 'Bạn gửi câu hỏi hơi nhanh. Chờ một phút rồi thử lại nhé.'
          : 'Chưa kết nối được với FloraBot. Câu hỏi của bạn vẫn được giữ lại.';
      setExchanges((previous) =>
        previous.map((item) => (item.id === exchangeId ? { ...item, error: message } : item)),
      );
      setQuestion((draft) => draft || text);
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
    if (locating) return;
    setLocationError('');
    if (!window.isSecureContext) {
      setLocationError('Định vị cần HTTPS hoặc localhost. Bạn vẫn có thể chọn kiosk bằng tay.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt chưa hỗ trợ định vị. Bạn vẫn có thể hỏi hoặc chọn kiosk.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const origin = { latitude: coords.latitude, longitude: coords.longitude };
        setLocation(origin);
        setLocating(false);
        void send({ question: 'Kiosk nào gần tôi nhất?', mode: 'PREORDER' }, undefined, origin);
      },
      (error) => {
        setLocationError(
          error.code === 1
            ? 'Bạn chưa cho phép định vị. Vẫn có thể nhập câu hỏi hoặc chọn kiosk.'
            : 'Chưa lấy được vị trí. Bạn có thể thử lại hoặc chọn kiosk.',
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  const viewportStyle = viewport
    ? ({
        '--advisor-viewport-height': viewport.height + 'px',
        '--advisor-viewport-top': viewport.top + 'px',
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={root}
      className={'flower-advisor-root flower-advisor-root--' + audience}
      data-state={closing ? 'closing' : opened ? 'open' : 'closed'}
      style={viewportStyle}
      onAnimationEnd={(event) => {
        if (
          ['flower-advisor-exit', 'flower-advisor-mobile-exit'].includes(event.animationName) &&
          event.target === root.current?.querySelector('.flower-advisor')
        )
          finishClose();
      }}
    >
      <button
        type="button"
        className="flower-advisor-launch site-support-control"
        aria-label="Tư vấn FloraBot"
        aria-haspopup="dialog"
        aria-expanded={opened}
        onClick={() => setOpened(true)}
      >
        <span className="site-support-label">Tư vấn FloraBot</span>
        <span className="site-support-icon" aria-hidden="true">
          <MessageSquare size={24} />
        </span>
      </button>
      <Modal
        open={opened}
        title="Tư vấn FloraBot"
        titleIcon={<Flower2 size={24} aria-hidden="true" />}
        headerActions={
          <button
            type="button"
            className="flower-advisor-expand"
            aria-label={expanded ? 'Thu nhỏ khung chat' : 'Phóng to khung chat'}
            title={expanded ? 'Thu nhỏ khung chat' : 'Phóng to khung chat'}
            aria-pressed={expanded}
            onClick={toggleExpanded}
          >
            {expanded ? (
              <ChevronDown size={20} aria-hidden="true" />
            ) : (
              <ArrowUpRight size={20} aria-hidden="true" />
            )}
          </button>
        }
        onClose={close}
        className={
          'flower-advisor' +
          (expanded ? ' flower-advisor--expanded' : '') +
          (exchanges.length ? ' flower-advisor--conversation' : '')
        }
      >
        {choosingKiosk ? (
          <FlowerAdvisorKioskPicker
            items={kiosks.data ?? []}
            selectedId={kioskId}
            loading={kiosks.isPending || kiosks.isFetching}
            failed={kiosks.isError}
            onRetry={() => void kiosks.refetch()}
            onSelect={(value) => {
              setKioskId(value);
              setChoosingKiosk(false);
            }}
            onBack={() => setChoosingKiosk(false)}
          />
        ) : (
          <>
            <div
              ref={messages}
              className="flower-advisor-messages"
              role="region"
              aria-label="Tư vấn và hội thoại"
              tabIndex={-1}
              data-autofocus
            >
              <div className="flower-advisor-welcome">
                <p>FloraBot xin chào, chúng tôi có thể giúp gì cho bạn ạ?</p>
                <div className="flower-advisor-prompts" aria-label="Câu hỏi gợi ý">
                  {prompts[audience].map(({ label, ...prompt }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(prompt)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {audience === 'customer' && (
                <div className="flower-advisor-tools">
                  <div className="flower-advisor-tool-row">
                    <button
                      type="button"
                      className="flower-advisor-location-button"
                      aria-label={location ? 'Bỏ vị trí của tôi' : 'Dùng vị trí của tôi'}
                      title={location ? 'Bỏ vị trí của tôi' : 'Tìm kiosk gần vị trí của tôi'}
                      aria-pressed={Boolean(location)}
                      disabled={locating || (!location && busy)}
                      onClick={() => (location ? setLocation(undefined) : locate())}
                    >
                      {location ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        <Navigation size={16} aria-hidden="true" />
                      )}
                      <span>
                        {location ? 'Đã bật vị trí' : locating ? 'Đang định vị…' : 'Vị trí của tôi'}
                      </span>
                    </button>
                    <button
                      ref={kioskTrigger}
                      type="button"
                      className="flower-advisor-kiosk-trigger"
                      aria-label="Chọn kiosk mua tại tủ"
                      title={
                        kiosks.data?.find((item) => item.id === kioskId)?.name ||
                        'Chọn kiosk mua tại tủ'
                      }
                      onClick={() => {
                        chatScrollTop.current = messages.current?.scrollTop ?? 0;
                        setChoosingKiosk(true);
                      }}
                    >
                      <MapPin size={16} aria-hidden="true" />
                      <span>
                        {kiosks.data?.find((item) => item.id === kioskId)?.name || 'Chọn kiosk'}
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                  {location && (
                    <p className="flower-advisor-location-note" role="status">
                      Đã bật gợi ý gần bạn.
                    </p>
                  )}
                  {locationError && (
                    <p className="flower-advisor-location-note" role="status">
                      {locationError}
                    </p>
                  )}
                  {kioskId && (
                    <button
                      type="button"
                      className="flower-advisor-text-button"
                      disabled={busy}
                      onClick={() =>
                        void send({ question: 'Ở tủ này có hoa nào mua ngay?', mode: 'WALK_IN' })
                      }
                    >
                      Xem hoa tại tủ
                    </button>
                  )}
                </div>
              )}
              <div
                className="flower-advisor-conversation"
                role="log"
                aria-label="Hội thoại với FloraBot"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {exchanges.map((exchange) => (
                  <div className="flower-advisor-exchange" key={exchange.id}>
                    <p className="flower-advisor-question">
                      <span className="sr-only">Bạn: </span>
                      {exchange.input.question}
                    </p>
                    <div className="flower-advisor-bot-row">
                      <span className="flower-advisor-avatar" aria-hidden="true">
                        <Flower2 size={20} />
                      </span>
                      <div
                        className="flower-advisor-answer"
                        key={exchange.error ? 'error' : exchange.answer ? 'answer' : 'pending'}
                      >
                        {exchange.error && <p className="flower-advisor-error">{exchange.error}</p>}
                        {exchange.answer && <p>{exchange.answer.message}</p>}
                        {audience === 'customer' && exchange.answer?.intent === 'FLOWERS' && (
                          <FlowerAdvisorKioskCards
                            question={exchange.input.question}
                            message={exchange.answer.message}
                            items={kiosks.data ?? []}
                          />
                        )}
                        {(exchange.error || exchange.answer?.intent === 'UNAVAILABLE') && (
                          <button
                            type="button"
                            disabled={busy}
                            className="flower-advisor-retry"
                            onClick={() => void send(exchange.input, exchange.id)}
                          >
                            Gửi lại câu hỏi
                          </button>
                        )}
                        {exchange.answer?.intent !== 'UNAVAILABLE' &&
                          exchange.answer?.suggestions
                            ?.slice(0, 3)
                            .map((item) => <FlowerAdvisorSuggestion key={item.id} item={item} />)}
                        {busy && !exchange.error && !exchange.answer && (
                          <p className="flower-advisor-pending">
                            <span className="flower-advisor-typing" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                            FloraBot đang tìm gợi ý…
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flower-advisor-compose">
              <form onSubmit={submit} className="flower-advisor-form">
                <textarea
                  ref={composer}
                  aria-label="Câu hỏi cho FloraBot"
                  aria-describedby={id + '-hint'}
                  placeholder={
                    audience === 'seller' ? 'Hỏi về mẫu hoa, mô tả, tag…' : 'Nhập câu hỏi của bạn…'
                  }
                  value={question}
                  rows={1}
                  maxLength={500}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      window.matchMedia('(pointer: fine)').matches
                    ) {
                      event.preventDefault();
                      void send({ question });
                    }
                  }}
                />
                <button type="submit" aria-label="Gửi câu hỏi" disabled={busy || !question.trim()}>
                  <Send size={18} aria-hidden="true" />
                </button>
              </form>
              <p id={id + '-hint'} className="flower-advisor-compose-hint">
                <span>FloraBot có thể nhầm. Hãy kiểm tra lại thông tin</span>
                <span>{question.length}/500</span>
              </p>
              <Link className="flower-advisor-privacy" href="/chinh-sach-rieng-tu">
                Chính sách bảo mật
              </Link>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
