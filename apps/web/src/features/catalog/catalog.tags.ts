import {
  flowerColors,
  flowerMaterials,
  flowerTags,
  getFlowerTypeCode,
} from '@/shared/lib/flower-tags';
import type { CatalogItem } from './catalog.types';

const occasions = {
  birthday: 'Sinh nhật',
  anniversary: 'Kỷ niệm',
  valentine: 'Valentine',
  'womens-day': 'Ngày Phụ nữ',
  'teachers-day': 'Ngày Nhà giáo',
  'mothers-day': 'Ngày của Mẹ',
  apology: 'Lời xin lỗi',
  congrats: 'Chúc mừng',
  sympathy: 'Chia buồn',
  graduation: 'Tốt nghiệp',
  'grand-opening': 'Khai trương',
  love: 'Tình yêu',
  thanks: 'Cảm ơn',
  other: 'Một dịp khác',
};

const definitions = [
  { group: 'flower', label: 'Loại hoa', values: flowerTags },
  { group: 'color', label: 'Màu sắc', values: flowerColors },
  { group: 'occasion', label: 'Dịp tặng', values: occasions },
  { group: 'material', label: 'Chất liệu', values: flowerMaterials },
] as const;

const normalizeTag = (value: string) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('đ', 'd')
    .replace(/[\s_]+/g, '-');

export function getCatalogTagGroup(tag: string) {
  return tag.slice(0, tag.indexOf(':'));
}

const sharedTags = new Map(
  definitions.flatMap(({ group, values }) =>
    Object.entries(values).map(([code, label]) => [group + ':' + code, label] as const),
  ),
);

export function readCatalogTags(values: readonly string[]) {
  return [...new Set(values)].filter((tag) => {
    if (sharedTags.has(tag)) return true;
    if (!/^(occasion|custom):.{1,160}$/u.test(tag)) return false;
    return [...tag].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
  });
}

export function getCatalogItemTags(item: Pick<CatalogItem, 'tags' | 'occasion'>) {
  const tags = new Map<string, string>();
  const values = [...(item.tags ?? []), ...(item.occasion ? ['occasion:' + item.occasion] : [])];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const flower = getFlowerTypeCode(value);
    if (flower) {
      tags.set('flower:' + flower, flowerTags[flower]);
      continue;
    }

    const colon = value.indexOf(':');
    const prefix = colon === -1 ? '' : value.slice(0, colon).toLowerCase();
    const label = colon === -1 ? value : value.slice(colon + 1).trim();
    const normalized = normalizeTag(label);
    if (!normalized) continue;
    const group = definitions.find((definition) => definition.group === prefix);
    const candidates = group ? [group] : prefix ? [] : definitions.slice(1);
    const match = candidates.flatMap(({ group, values }) =>
      Object.entries(values)
        .filter(
          ([code, name]) =>
            normalized === normalizeTag(name) ||
            ((prefix === group || code !== 'other') && normalized === code),
        )
        .map(([code, name]) => [group + ':' + code, name] as const),
    )[0];
    if (match) tags.set(...match);
    else if (prefix === 'occasion') tags.set('occasion:' + normalized, label);
    else tags.set('custom:' + normalizeTag(value), value);
  }
  return tags;
}

export function getCatalogTagGroups(items: readonly CatalogItem[]) {
  const tags = new Map(sharedTags);
  for (const item of items) {
    for (const [id, label] of getCatalogItemTags(item)) {
      if (!tags.has(id) && readCatalogTags([id]).length) tags.set(id, label);
    }
  }
  return [...definitions, { group: 'custom', label: 'Tag khác' }]
    .map(({ group, label }) => ({
      group,
      label,
      options: [...tags]
        .filter(([id]) => getCatalogTagGroup(id) === group)
        .map(([id, label]) => ({ id, label })),
    }))
    .filter(({ options }) => options.length > 0);
}
