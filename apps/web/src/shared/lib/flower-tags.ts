export const flowerTags = {
  rose: 'Hoa hồng',
  sunflower: 'Hướng dương',
  tulip: 'Tulip',
  chrysanthemum: 'Hoa cúc',
  gerbera: 'Đồng tiền',
  lisianthus: 'Cát tường',
  carnation: 'Cẩm chướng',
  hydrangea: 'Cẩm tú cầu',
  lily: 'Hoa ly',
  orchid: 'Hoa lan',
  peony: 'Mẫu đơn',
  'babys-breath': 'Hoa baby',
  other: 'Loại khác',
};

export type FlowerTypeCode = keyof typeof flowerTags;

function normalizeFlowerLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Accept exact legacy type labels, never infer a type from product names or prose. */
export function getFlowerTypeCode(tag: string): FlowerTypeCode | undefined {
  const value = tag.trim();
  if (value.includes(':')) {
    const [group, code, extra] = value.toLowerCase().split(':');
    return group === 'flower' && code && extra === undefined && Object.hasOwn(flowerTags, code)
      ? (code as FlowerTypeCode)
      : undefined;
  }
  const normalized = normalizeFlowerLabel(value);
  for (const [code, label] of Object.entries(flowerTags)) {
    // "other" is ambiguous without a group: it may refer to color or material.
    if (code === 'other') continue;
    const normalizedLabel = normalizeFlowerLabel(label);
    if (
      normalized === code ||
      normalized === normalizedLabel ||
      normalized === `hoa ${normalizedLabel}`
    )
      return code as FlowerTypeCode;
  }
  return undefined;
}

export function getFlowerTypeCodes(tags: readonly string[] | null | undefined): FlowerTypeCode[] {
  return [...new Set((tags ?? []).map(getFlowerTypeCode).filter((code) => code !== undefined))];
}

/** Normalize only recognized flower types; retain color/material and custom tags. */
export function normalizeFlowerTags(tags: readonly string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => {
          const trimmed = tag.trim();
          const code = getFlowerTypeCode(trimmed);
          return code ? `flower:${code}` : trimmed;
        })
        .filter(Boolean),
    ),
  ];
}

export const flowerColors = {
  red: 'Đỏ',
  pink: 'Hồng',
  white: 'Trắng',
  yellow: 'Vàng',
  orange: 'Cam',
  purple: 'Tím',
  blue: 'Xanh',
  multicolor: 'Nhiều màu',
};

export const flowerMaterials = {
  wax: 'Sáp',
  fabric: 'Lụa/vải',
  yarn: 'Len',
  paper: 'Giấy',
  plastic: 'Nhựa',
  other: 'Khác',
};

export function tagIsKnown(tag: string, group: string, labels: Record<string, string>) {
  const prefix = group + ':';
  return tag.startsWith(prefix) && Object.hasOwn(labels, tag.slice(prefix.length));
}

export function flowerTagLabel(tag: string) {
  const groups: Record<string, Record<string, string>> = {
    flower: flowerTags,
    color: flowerColors,
    material: flowerMaterials,
  };
  const [group, value] = tag.split(':', 2);
  const labels = groups[group];
  return value && labels && tagIsKnown(tag, group, labels) ? labels[value] : tag;
}
