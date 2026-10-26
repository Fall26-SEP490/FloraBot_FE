import type { PriceFilter } from './catalog.types';

export const OCCASIONS = [
  'Sinh nhật',
  'Khai trương',
  'Tình yêu',
  'Tốt nghiệp',
  'Cảm ơn',
  'Kỷ niệm',
  'Chúc mừng',
] as const;

export const PRICE_TIERS: { id: PriceFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả mức giá' },
  { id: 'under300', label: 'Dưới 300.000 đ' },
  { id: '300to600', label: '300.000 đ – 600.000 đ' },
  { id: '600to1000', label: 'Trên 600.000 đ đến 1.000.000 đ' },
  { id: 'over1000', label: 'Trên 1.000.000 đ' },
];

export const PRICE_TIER_ACTIVE_LABELS: Record<string, string> = {
  under300: '< 300.000 đ',
  '300to600': '300k – 600k',
  '600to1000': 'Trên 600k – 1tr',
  over1000: '> 1.000.000 đ',
};

export const OCCASION_BADGE_CLASSES: Record<string, string> = {
  'Sinh nhật': 'occasion-sinhnhat',
  'Tốt nghiệp': 'occasion-totnghiep',
  'Tình yêu': 'occasion-tinhyeu',
  'Khai trương': 'occasion-khaitruong',
  'Cảm ơn': 'occasion-camon',
  'Kỷ niệm': 'occasion-kyniem',
  'Chúc mừng': 'occasion-chucmung',
};
