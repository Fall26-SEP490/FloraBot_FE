import { z } from 'zod';

export const priceSchema = z.object({
  price: z
    .number('Nhập giá bán bằng số.')
    .int('Giá bán phải là số nguyên.')
    .positive('Giá bán phải lớn hơn 0.')
    .max(Number.MAX_SAFE_INTEGER, 'Giá bán vượt giới hạn cho phép.'),
});

export const dimensionSchema = (label: string) =>
  z
    .number(`Nhập ${label.toLowerCase()} bằng số.`)
    .min(0.01, `${label} phải từ 0.01 cm trở lên.`)
    .max(1000, `${label} tối đa 1000 cm.`)
    .refine(
      (val) => Number.isFinite(val) && Math.abs(Math.round(val * 100) - val * 100) < 1e-6,
      `${label} tối đa 2 chữ số thập phân.`,
    );

export const productMetadataSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Nhập tên mẫu hoa (tối thiểu 1 ký tự).')
      .max(120, 'Tên mẫu hoa tối đa 120 ký tự.'),
    description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự.'),
    price: z
      .number('Nhập giá bán bằng số.')
      .int('Giá bán phải là số nguyên.')
      .positive('Giá bán phải lớn hơn 0.')
      .max(Number.MAX_SAFE_INTEGER, 'Giá bán vượt giới hạn cho phép.'),
    lengthCm: dimensionSchema('Chiều dài'),
    widthCm: dimensionSchema('Chiều rộng'),
    heightCm: dimensionSchema('Chiều cao'),
    tagsInput: z.string().max(1500, 'Danh sách từ khóa quá dài.'),
  })
  .superRefine((data, ctx) => {
    if (data.tagsInput) {
      const raw = data.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (raw.length > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tagsInput'],
          message: 'Tối đa 20 từ khóa.',
        });
      }
      const duplicates = raw.filter((item, idx) => raw.indexOf(item) !== idx);
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tagsInput'],
          message: `Từ khóa trùng lặp: "${duplicates[0]}". Mỗi từ khóa chỉ nhập một lần.`,
        });
      }
      const tooLong = raw.find((t) => t.length > 64);
      if (tooLong) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tagsInput'],
          message: 'Mỗi từ khóa tối đa 64 ký tự.',
        });
      }
    }
  });

export const productCreateSchema = z.intersection(
  productMetadataSchema,
  z.object({
    kioskId: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'Chọn kiosk thuộc quyền quản lý của shop.',
      ),
  }),
);

export type ProductFormValues = z.infer<typeof productMetadataSchema>;
export type ProductCreateFormValues = z.infer<typeof productCreateSchema>;
