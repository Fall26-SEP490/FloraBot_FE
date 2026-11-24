import type { PriceFilter } from './catalog.types';

export const PRICE_FILTERS = {
  all: { label: 'Tất cả mức giá', matches: () => true },
  under100: { label: 'Dưới 100.000 đ', matches: (price: number) => price < 100000 },
  '100to200': {
    label: '100.000 – 200.000 đ',
    matches: (price: number) => price >= 100000 && price <= 200000,
  },
  over200: { label: 'Trên 200.000 đ', matches: (price: number) => price > 200000 },
  under300: { label: 'Dưới 300.000 đ', matches: (price: number) => price < 300000 },
  '300to600': {
    label: '300.000 – 600.000 đ',
    matches: (price: number) => price >= 300000 && price <= 600000,
  },
  '600to1000': {
    label: '600.000 – 1.000.000 đ',
    matches: (price: number) => price > 600000 && price <= 1000000,
  },
  over1000: { label: 'Trên 1.000.000 đ', matches: (price: number) => price > 1000000 },
};

export const PRICE_FILTER_IDS = Object.keys(PRICE_FILTERS) as PriceFilter[];
export const DEFAULT_PRICE_FILTERS: readonly PriceFilter[] = [
  'all',
  'under100',
  '100to200',
  'over200',
];

export const PREORDER_FILTER_LABEL = 'Còn nhận đặt trước';

export const RATING_FILTERS = {
  all: 'Tất cả mức sao',
  '3': 'Từ 3 sao',
  '4': 'Từ 4 sao',
  '5': '5 sao',
};
export type RatingFilter = keyof typeof RATING_FILTERS;
export const RATING_FILTER_IDS = ['all', '3', '4', '5'] as const satisfies readonly RatingFilter[];
