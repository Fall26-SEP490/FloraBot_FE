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
