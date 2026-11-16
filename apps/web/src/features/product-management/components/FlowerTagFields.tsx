import { flowerColors, flowerMaterials, flowerTags, tagIsKnown } from '@/shared/lib/flower-tags';

const groups = [
  { key: 'flower', label: 'Loại hoa', options: flowerTags, multiple: true },
  { key: 'color', label: 'Màu chủ đạo', options: flowerColors, multiple: true },
  { key: 'material', label: 'Chất liệu', options: flowerMaterials, multiple: false },
] as const;

export function FlowerTagFields({
  id,
  value,
  disabled,
  required,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const free = value
    .split(',')
    .filter((part) => !groups.some((group) => tagIsKnown(part.trim(), group.key, group.options)))
    .join(',');

  return (
    <>
      {groups.map((group) => {
        const groupId = `${id}-${group.key}`;
        const selected = tags.filter((tag) => tagIsKnown(tag, group.key, group.options));
        return (
          <div className="form-field" key={group.key}>
            <label htmlFor={groupId}>
              {group.label}
              {required && group.multiple ? ' (bắt buộc)' : ''}
            </label>
            <select
              id={groupId}
              disabled={disabled}
              multiple={group.multiple}
              value={group.multiple ? selected : (selected[0] ?? '')}
              onChange={(event) => {
                const rest = tags.filter((tag) => !tagIsKnown(tag, group.key, group.options));
                const next = Array.from(
                  event.target.selectedOptions,
                  (option) => option.value,
                ).filter(Boolean);
                onChange([...rest, ...next].join(', '));
              }}
            >
              {!group.multiple && <option value="">Chưa chọn</option>}
              {Object.entries(group.options).map(([code, label]) => (
                <option key={code} value={`${group.key}:${code}`}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      <label htmlFor={id}>Từ khóa tìm kiếm (phân cách bằng dấu phẩy)</label>
      <input
        id={id}
        type="text"
        disabled={disabled}
        value={free.trimStart()}
        placeholder="sinh nhật, bạn bè, nhẹ nhàng"
        onChange={(event) => {
          const selected = tags.filter((tag) =>
            groups.some((group) => tagIsKnown(tag, group.key, group.options)),
          );
          onChange([...selected, event.target.value].join(', '));
        }}
      />
    </>
  );
}
