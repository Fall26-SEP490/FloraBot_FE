import { useState } from 'react';
import { Button, useHydrated } from '@florabot/ui';
import { money } from '@florabot/contracts';
import { flowerPhotos } from '@florabot/ui/flower-photos';
const flowers = [
  {
    name: 'Hồng trắng dịu dàng',
    price: 220000,
    photo: flowerPhotos.whiteRose,
    tags: ['MOTHER', 'TEACHER', 'WHITE'],
  },
  {
    name: 'Tulip hồng',
    price: 280000,
    photo: flowerPhotos.tulipVase,
    tags: ['LOVER', 'BIRTHDAY', 'WARM'],
  },
  {
    name: 'Hướng dương',
    price: 300000,
    photo: flowerPhotos.sunflowers,
    tags: ['FRIEND', 'CONGRATS', 'BRIGHT'],
  },
  {
    name: 'Hoa ly hồng',
    price: 250000,
    photo: flowerPhotos.pinkLilies,
    tags: ['TEACHER', 'THANKS', 'WARM'],
  },
  { name: 'Hồng đỏ', price: 350000, photo: flowerPhotos.redRoses, tags: ['LOVER', 'ROMANTIC'] },
];
export default function GiftDemo() {
  const ready = useHydrated();
  const [result, setResult] = useState<typeof flowers>([]);
  const [summary, setSummary] = useState('');
  const [budget, setBudget] = useState(300000);
  const [revision, setRevision] = useState(0);
  return (
    <div className="gift-demo">
      <div className="gift-picker">
        <div className="gift-picker-art">
          <h3 id="gift-picker-title">Chọn hoa để tặng</h3>
          <img
            src={flowerPhotos.pastelBouquet.src}
            srcSet={flowerPhotos.pastelBouquet.webpSrcSet}
            sizes="(max-width: 700px) 90vw, 35vw"
            width={flowerPhotos.pastelBouquet.width}
            height={flowerPhotos.pastelBouquet.height}
            alt={flowerPhotos.pastelBouquet.alt}
            loading="lazy"
            decoding="async"
          />
        </div>
        <form
          onChange={() => {
            setResult([]);
            setSummary('');
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const recipient = String(data.get('recipient'));
            const occasion = String(data.get('occasion'));
            const tone = String(data.get('tone'));
            const chosenBudget = Number(data.get('budget'));
            const score = (flower: (typeof flowers)[number]) =>
              flower.tags.filter((tag) => [recipient, occasion, tone].includes(tag)).length;
            const selected = flowers
              .filter((f) => f.price <= chosenBudget)
              .sort((a, b) => score(b) - score(a))
              .slice(0, 3);
            setResult(selected);
            setRevision((value) => value + 1);
            setSummary(
              selected.length
                ? `${selected.length} gợi ý trong ngân sách ${money(chosenBudget)}`
                : 'Chưa có hoa phù hợp. Bạn thử ngân sách khác nhé.',
            );
          }}
          aria-labelledby="gift-picker-title"
        >
          <div className="gift-fields">
            <div>
              <label htmlFor="recipient">Bạn tặng ai?</label>
              <select id="recipient" name="recipient">
                <option value="MOTHER">Mẹ / người thân</option>
                <option value="LOVER">Người thương</option>
                <option value="FRIEND">Bạn bè</option>
                <option value="TEACHER">Thầy cô</option>
              </select>
            </div>
            <div>
              <label htmlFor="occasion">Nhân dịp gì?</label>
              <select id="occasion" name="occasion">
                <option value="BIRTHDAY">Sinh nhật</option>
                <option value="THANKS">Cảm ơn</option>
                <option value="CONGRATS">Chúc mừng</option>
              </select>
            </div>
            <div className="gift-tone">
              <label htmlFor="tone">Phong cách</label>
              <select id="tone" name="tone">
                <option value="WARM">Ấm áp, nhẹ nhàng</option>
                <option value="BRIGHT">Tươi sáng</option>
                <option value="ROMANTIC">Lãng mạn</option>
              </select>
            </div>
            <fieldset className="gift-budget">
              <legend>Ngân sách tối đa</legend>
              <input type="hidden" name="budget" value={budget} />
              <div className="budget-options">
                {[300000, 500000, 700000].map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-label={money(value)}
                    aria-pressed={budget === value}
                    onClick={() => {
                      setBudget(value);
                      setResult([]);
                      setSummary('');
                    }}
                  >
                    <span className="budget-full">{money(value)}</span>
                    <span className="budget-short" aria-hidden="true">
                      {value / 1000}k
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <Button type="submit" disabled={!ready}>
            Xem gợi ý hoa{' '}
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Button>
        </form>
      </div>
      <p className="gift-status" role="status">
        {summary}
      </p>
      {result.length > 0 && (
        <ul className="gift-results" key={revision}>
          {result.map((f) => (
            <li key={f.name}>
              <picture>
                <source
                  type="image/avif"
                  srcSet={f.photo.avifSrcSet}
                  sizes="(max-width: 700px) 90vw, 28vw"
                />
                <img
                  src={f.photo.src}
                  srcSet={f.photo.webpSrcSet}
                  sizes="(max-width: 700px) 90vw, 28vw"
                  width={f.photo.width}
                  height={f.photo.height}
                  alt={f.photo.alt}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <div className="gift-result-copy">
                <h3>{f.name}</h3>
                <p>{money(f.price)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
