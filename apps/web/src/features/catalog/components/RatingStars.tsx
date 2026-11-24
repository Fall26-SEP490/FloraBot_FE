import { Star } from '@florabot/ui';
import '../styles/product-reviews.css';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function RatingStars({ value }: { value: number }) {
  return (
    <span
      className="flower-rating-stars"
      role="img"
      aria-label={`${number.format(value)} trên 5 sao`}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <span key={index} className="flower-rating-star" aria-hidden="true">
          <Star size={16} strokeWidth={1.5} />
          <span
            className="flower-rating-stars-fill"
            style={{ width: `${Math.max(0, Math.min(1, value - index)) * 100}%` }}
          >
            <Star size={16} strokeWidth={1.5} />
          </span>
        </span>
      ))}
    </span>
  );
}
