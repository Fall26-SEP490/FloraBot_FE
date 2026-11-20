import type { FlowerChatMode, FlowerChatPrompt } from './flower-advisor.types';
import type { CustomerKioskLocationItem } from '../kiosk-location/kiosk-location.types';

const foldLocation = (value: string) =>
  value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

/** Match only named public kiosks; never turn model-provided addresses into map links. */
export function mentionedKiosks(
  question: string,
  message: string,
  items: CustomerKioskLocationItem[],
) {
  if (!/kiosk|\btu\b|dia chi|vi tri/.test(foldLocation(question))) return [];
  const text = foldLocation(message);
  const identities = items
    .flatMap((kiosk) => [kiosk.name, kiosk.code])
    .filter(Boolean)
    .map(foldLocation);
  return items
    .map((kiosk) => {
      const indexes = [kiosk.name, kiosk.code]
        .filter(Boolean)
        .map(foldLocation)
        .filter((name) => name.length >= 3)
        .map((name) => {
          let start = text.indexOf(name);
          while (start >= 0) {
            const before = text[start - 1] ?? '';
            const after = text[start + name.length] ?? '';
            const longerMatch = identities.some(
              (identity) =>
                identity.length > name.length &&
                identity.startsWith(name) &&
                text.startsWith(identity, start),
            );
            if (!longerMatch && !/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after))
              return start;
            start = text.indexOf(name, start + 1);
          }
          return -1;
        })
        .filter((index) => index >= 0);
      return { kiosk, index: indexes.length ? Math.min(...indexes) : -1 };
    })
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index)
    .slice(0, 3)
    .map((match) => match.kiosk);
}

// Match the API's default and explicit purchase wording. In particular, do not
// send a preorder location or constrain preorder results to the walk-in selector.
export function flowerChatMode(input: FlowerChatPrompt): FlowerChatMode {
  if (input.mode) return input.mode;
  const text = input.question.toLowerCase();
  if (/đặt trước|pre-order|preorder/.test(text)) return 'PREORDER';
  if (/mua ngay|lấy ngay|mua tại tủ|lấy tại tủ|walk-in|walk in/.test(text)) return 'WALK_IN';
  return 'PREORDER';
}
