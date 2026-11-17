import { describe, expect, it } from 'vitest';
import {
  flowerTags,
  getFlowerTypeCode,
  getFlowerTypeCodes,
  normalizeFlowerTags,
} from '../apps/web/src/shared/lib/flower-tags';
import { parseTags } from '../apps/web/src/features/product-management/product.utils';

describe('Flower type compatibility', () => {
  it.each(['hoa hồng', 'Hoa Hồng', ' HOA HỒNG ', 'hoa hong', 'rose', 'flower:rose', 'FLOWER:ROSE'])(
    'recognizes the rose tag %s',
    (tag) => expect(getFlowerTypeCode(tag)).toBe('rose'),
  );

  it.each(Object.entries(flowerTags))('recognizes the canonical type %s', (code, label) => {
    expect(getFlowerTypeCode(`flower:${code}`)).toBe(code);
    if (code !== 'other') expect(getFlowerTypeCode(label)).toBe(code);
  });

  it('does not guess types from ambiguous colors, unknown tags or prose', () => {
    for (const tag of [
      'hồng',
      'color:pink',
      'material:paper',
      'other',
      'flower:unknown',
      'bó hoa hồng đẹp',
    ])
      expect(getFlowerTypeCode(tag)).toBeUndefined();
    expect(getFlowerTypeCodes(undefined)).toEqual([]);
  });

  it('counts multiple forms of the same flower only once', () => {
    expect(getFlowerTypeCodes(['hoa hồng', 'flower:rose', 'Hoa Hồng', 'Tulip'])).toEqual([
      'rose',
      'tulip',
    ]);
  });

  it('normalizes seller saves while retaining other tag groups and custom keywords', () => {
    const tags = [
      'hoa hồng',
      'flower:rose',
      'color:pink',
      'material:paper',
      'sinh nhật',
      'hoa chưa biết',
    ];
    const expected = ['flower:rose', 'color:pink', 'material:paper', 'sinh nhật', 'hoa chưa biết'];
    expect(normalizeFlowerTags(tags)).toEqual(expected);
    expect(parseTags(tags.join(', '))).toEqual(expected);
  });
});
