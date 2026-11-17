import { flowerColors, flowerMaterials, flowerTags, tagIsKnown } from '@/shared/lib/flower-tags';
import { Check, Plus } from '@florabot/ui';

const groups = [
  { key: 'flower', label: 'Loại hoa', options: flowerTags },
  { key: 'color', label: 'Màu chủ đạo', options: flowerColors },
] as const;

function isStructuredTag(tag: string) {
  return (
    groups.some((group) => tagIsKnown(tag, group.key, group.options)) ||
    tagIsKnown(tag, 'material', flowerMaterials)
  );
}

export function FlowerTagFields({
  id,
  value,
  disabled,
  required,
  section,
  missingGroups = [],
  errorId,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  required?: boolean;
  section?: 'choices' | 'extras';
  missingGroups?: Array<'flower' | 'color'>;
  errorId?: string;
  onChange: (value: string) => void;
}) {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const free = value
    .split(',')
    .filter((part) => !isStructuredTag(part.trim()))
    .join(',');

  return (
    <>
      {section !== 'extras' &&
        groups.map((group) => {
          const groupId = `${id}-${group.key}`;
          const missing = missingGroups.includes(group.key);
          return (
            <fieldset
              className="product-tag-group"
              key={group.key}
              id={groupId}
              disabled={disabled}
              aria-invalid={missing || undefined}
              aria-describedby={missing ? errorId : undefined}
            >
              <legend>
                {group.label}
                {required && <span className="sr-only"> (bắt buộc)</span>}
              </legend>
              <div className="product-tag-choices">
                {Object.entries(group.options).map(([code, label]) => {
                  const tag = `${group.key}:${code}`;
                  const selected = tags.includes(tag);
                  const Icon = selected ? Check : Plus;
                  return (
                    <button
                      key={tag}
                      type="button"
                      className="product-tag-choice"
                      aria-pressed={selected}
                      aria-describedby={missing ? errorId : undefined}
                      onClick={() =>
                        onChange(
                          (selected ? tags.filter((value) => value !== tag) : [...tags, tag]).join(
                            ', ',
                          ),
                        )
                      }
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      {section !== 'choices' && (
        <>
          <div className="form-field">
            <label htmlFor={`${id}-material`}>Chất liệu</label>
            <select
              id={`${id}-material`}
              disabled={disabled}
              value={tags.find((tag) => tagIsKnown(tag, 'material', flowerMaterials)) ?? ''}
              onChange={(event) => {
                const rest = tags.filter((tag) => !tagIsKnown(tag, 'material', flowerMaterials));
                const next = event.target.value;
                onChange((next ? [...rest, next] : rest).join(', '));
              }}
            >
              <option value="">Chưa chọn</option>
              {Object.entries(flowerMaterials).map(([code, label]) => (
                <option key={code} value={`material:${code}`}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={id}>Từ khóa tìm kiếm</label>
            <input
              id={id}
              type="text"
              disabled={disabled}
              value={free.trimStart()}
              placeholder="Ví dụ: pastel, tối giản"
              aria-invalid={Boolean(errorId) || undefined}
              aria-describedby={errorId ? `${id}-hint ${errorId}` : `${id}-hint`}
              onChange={(event) => {
                const selected = tags.filter(isStructuredTag);
                onChange([...selected, event.target.value].join(', '));
              }}
            />
            <p id={`${id}-hint`} className="quiet field-subhint">
              Ngăn cách từ khóa bằng dấu phẩy.
            </p>
          </div>
        </>
      )}
    </>
  );
}
