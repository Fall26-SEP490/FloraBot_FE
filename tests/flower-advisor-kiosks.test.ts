import { expect, it } from 'vitest';
import { mentionedKiosks } from '../apps/web/src/features/flower-advisor/flower-advisor.utils';
import type { CustomerKioskLocationItem } from '../apps/web/src/features/kiosk-location/kiosk-location.types';
const items = [
  { id: 'short', name: 'Kiosk HCM', code: 'K-HCM' },
  { id: '07', name: 'Kiosk HCM 07', code: 'K-HCM-07' },
  { id: '08', name: 'Kiosk HCM 08', code: 'K-HCM-08' },
] as CustomerKioskLocationItem[];
it('uses public identities and preserves the answer order without prefix collisions', () => {
  expect(
    mentionedKiosks('Kiosk nào gần tôi?', 'Gần bạn có K-HCM-08, sau đó Kiosk HCM 07.', items).map(
      (k) => k.id,
    ),
  ).toEqual(['08', '07']);
});
it('does not invent cards from unknown kiosk names or flower questions', () => {
  expect(mentionedKiosks('Kiosk gần tôi?', 'Kiosk không có trong dữ liệu.', items)).toEqual([]);
  expect(mentionedKiosks('Gợi ý hoa sinh nhật', 'Hoa tại Kiosk HCM 07.', items)).toEqual([]);
});
