export type CatalogItem = {
  productId: string;
  sellerId: string;
  shopName: string;
  name: string;
  description: string | null;
  price: number;
  kioskId: string;
  kioskName: string;
  address: string;
  photo: string | null;
  bouquets: string[];
  occasion?: string;
  tags?: string[];
  isDemoSample?: boolean;
};

// Valid seed sellers in DB (02_seed.sql):
// '20000000-0000-0000-0000-000000000001' -> Hoa Sài Gòn (APPROVED / ACTIVE)
// '20000000-0000-0000-0000-000000000002' -> Tiệm Hoa Mộc (APPROVED / ACTIVE)
// Valid seed kiosks in DB:
// '40000000-0000-0000-0000-000000000001' -> Kiosk Nhà Văn hóa Thanh Niên
// '40000000-0000-0000-0000-000000000002' -> Kiosk Đại học FPT
export const MOCK_CATALOG_ITEMS: CatalogItem[] = [
  {
    productId: '30000000-0000-0000-0000-000000000001',
    sellerId: '20000000-0000-0000-0000-000000000001',
    shopName: 'Hoa Sài Gòn',
    name: 'Hoa hồng pastel',
    description:
      'Bó hồng dành cho sinh nhật, gam màu pastel dịu dàng kết hợp hoa baby trắng nhập khẩu.',
    price: 350000,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Kiosk Đại học FPT',
    address: 'Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức',
    photo: '/images/floral-pink-online.webp',
    bouquets: ['50000000-0000-0000-0000-000000000001'],
    occasion: 'Sinh nhật',
    tags: ['Sinh nhật', 'Hoa hồng', 'Pastel'],
  },
  {
    productId: '30000000-0000-0000-0000-000000000002',
    sellerId: '20000000-0000-0000-0000-000000000001',
    shopName: 'Hoa Sài Gòn',
    name: 'Bó Hướng Dương Rạng Rỡ',
    description:
      'Hướng dương nở rộ phối lá bạc cao cấp, biểu trưng cho may mắn, thành công và nghị lực.',
    price: 280000,
    kioskId: '40000000-0000-0000-0000-000000000001',
    kioskName: 'Kiosk NVH Thanh Niên',
    address: '4 Phạm Ngọc Thạch, Phường Bến Nghé, Quận 1',
    photo: '/images/flowers-garden-480.webp',
    bouquets: ['50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003'],
    occasion: 'Tốt nghiệp',
    tags: ['Tốt nghiệp', 'Hướng dương', 'Chúc mừng'],
  },
  {
    productId: '30000000-0000-0000-0000-000000000003',
    sellerId: '20000000-0000-0000-0000-000000000002',
    shopName: 'Tiệm Hoa Mộc',
    name: 'Bó Hồng Đỏ Kiêu Sa',
    description:
      'Hồng đỏ cánh nhung bông lớn, bọc giấy kiếng sang trọng dành cho các dịp tỏ tình, kỷ niệm ngọt ngào.',
    price: 650000,
    kioskId: '40000000-0000-0000-0000-000000000001',
    kioskName: 'Kiosk NVH Thanh Niên',
    address: '4 Phạm Ngọc Thạch, Phường Bến Nghé, Quận 1',
    photo: '/images/flowers-pink.jpg',
    bouquets: [],
    occasion: 'Tình yêu',
    tags: ['Tình yêu', 'Kỷ niệm', 'Hoa hồng'],
  },
  {
    productId: '30000000-0000-0000-0000-000000000004',
    sellerId: '20000000-0000-0000-0000-000000000002',
    shopName: 'Tiệm Hoa Mộc',
    name: 'Lẵng Hoa Khai Trương Thịnh Vượng',
    description:
      'Lẵng hoa để bàn tone cam rực rỡ, kết hợp lan vũ nữ, đồng tiền và hồng cam mang ý nghĩa phát tài phát lộc.',
    price: 850000,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Kiosk Đại học FPT',
    address: 'Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức',
    photo: '/images/flowers-spring.jpg',
    bouquets: [],
    occasion: 'Khai trương',
    tags: ['Khai trương', 'Để bàn', 'Phát tài'],
  },
  {
    productId: '30000000-0000-0000-0000-000000000005',
    sellerId: '20000000-0000-0000-0000-000000000001',
    shopName: 'Hoa Sài Gòn',
    name: 'Bó Cúc Tana Tinh Khôi',
    description:
      'Cúc Tana nhỏ xinh như mặt trời bé con, phong cách mộc mạc nhẹ nhàng dành tặng bạn thân và đồng nghiệp.',
    price: 220000,
    kioskId: '40000000-0000-0000-0000-000000000001',
    kioskName: 'Kiosk NVH Thanh Niên',
    address: '4 Phạm Ngọc Thạch, Phường Bến Nghé, Quận 1',
    photo: '/images/floral-white-online.webp',
    bouquets: ['50000000-0000-0000-0000-000000000005'],
    occasion: 'Cảm ơn',
    tags: ['Cảm ơn', 'Cúc Tana', 'Tối giản'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000006',
    sellerId: '20000000-0000-0000-0000-000000000002',
    shopName: 'Tiệm Hoa Mộc',
    name: 'Bó Hoa Tulip Trắng Thuần Khiết',
    description:
      'Hoa tulip trắng nhập khẩu bó tròn phong cách Hàn Quốc thanh lịch, tôn lên nét duyên dáng thanh tao.',
    price: 520000,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Kiosk Đại học FPT',
    address: 'Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức',
    photo: '/images/flowers-white.jpg',
    bouquets: [],
    occasion: 'Sinh nhật',
    tags: ['Sinh nhật', 'Tulip', 'Hàn Quốc'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000007',
    sellerId: '20000000-0000-0000-0000-000000000002',
    shopName: 'Tiệm Hoa Mộc',
    name: 'Bó Baby Cầu Vồng Tươi Mát',
    description:
      'Hoa baby nhuộm màu pastel ngọt ngào, độ bền hoa khô lên đến nhiều tháng, thích hợp trang trí góc làm việc.',
    price: 190000,
    kioskId: '40000000-0000-0000-0000-000000000001',
    kioskName: 'Kiosk NVH Thanh Niên',
    address: '4 Phạm Ngọc Thạch, Phường Bến Nghé, Quận 1',
    photo: '/images/floral-pink-online.webp',
    bouquets: ['50000000-0000-0000-0000-000000000006'],
    occasion: 'Tình yêu',
    tags: ['Tình yêu', 'Baby', 'Cầu vồng'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000008',
    sellerId: '20000000-0000-0000-0000-000000000002',
    shopName: 'Tiệm Hoa Mộc',
    name: 'Hộp Hoa Hồng Sáp Thơm Vĩnh Cửu',
    description:
      'Hoa sáp thơm cao cấp lưu hương lâu, tạo hình hoa hồng tinh xảo đựng trong hộp mica sang trọng.',
    price: 320000,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Kiosk Đại học FPT',
    address: 'Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức',
    photo: '/images/flowers-pink.jpg',
    bouquets: ['50000000-0000-0000-0000-000000000007'],
    occasion: 'Kỷ niệm',
    tags: ['Kỷ niệm', 'Hoa sáp', 'Bền đẹp'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000009',
    sellerId: '20000000-0000-0000-0000-000000000001',
    shopName: 'Hoa Sài Gòn',
    name: 'Bó Cẩm Tú Cầu Xanh Hy Vọng',
    description:
      'Cẩm tú cầu Đà Lạt bông lớn xanh lam mát mắt, phối hoa cúc calimero và thạch thảo tím mộng mơ.',
    price: 420000,
    kioskId: '40000000-0000-0000-0000-000000000001',
    kioskName: 'Kiosk NVH Thanh Niên',
    address: '4 Phạm Ngọc Thạch, Phường Bến Nghé, Quận 1',
    photo: '/images/flowers-spring.jpg',
    bouquets: [],
    occasion: 'Chúc mừng',
    tags: ['Chúc mừng', 'Cẩm tú cầu', 'Đà Lạt'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000010',
    sellerId: '20000000-0000-0000-0000-000000000001',
    shopName: 'Hoa Sài Gòn',
    name: 'Bó Hoa Cát Tường May Mắn',
    description:
      'Cát tường viền tím tượng trưng cho tình cảm đằm thắm, thủy chung và may mắn vẹn tròn trong cuộc sống.',
    price: 360000,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Kiosk Đại học FPT',
    address: 'Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức',
    photo: '/images/floral-white-online.webp',
    bouquets: ['50000000-0000-0000-0000-000000000008'],
    occasion: 'Sinh nhật',
    tags: ['Sinh nhật', 'Cát tường', 'May mắn'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000011',
    sellerId: '20000000-0000-0000-0000-000000000001',
    shopName: 'Hoa Sài Gòn',
    name: 'Kệ Hoa Lan Hồ Điệp Sang Trọng',
    description:
      'Lan hồ điệp 3 cành trắng thuần khiết phối chậu sứ cao cấp, phù hợp mừng tân gia, sinh nhật đối tác.',
    price: 1150000,
    kioskId: '40000000-0000-0000-0000-000000000001',
    kioskName: 'Kiosk NVH Thanh Niên',
    address: '4 Phạm Ngọc Thạch, Phường Bến Nghé, Quận 1',
    photo: '/images/flowers-white.jpg',
    bouquets: [],
    occasion: 'Khai trương',
    tags: ['Khai trương', 'Lan hồ điệp', 'Cao cấp'],
    isDemoSample: true,
  },
  {
    productId: '30000000-0000-0000-0000-000000000012',
    sellerId: '20000000-0000-0000-0000-000000000002',
    shopName: 'Tiệm Hoa Mộc',
    name: 'Bó Thược Dược Đa Sắc Rực Rỡ',
    description:
      'Thược dược nhiều cánh nở rộ phối cùng lá khuynh diệp thơm dịu, mang lại không gian tươi vui tích cực.',
    price: 480000,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Kiosk Đại học FPT',
    address: 'Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức',
    photo: '/images/flowers-garden-480.webp',
    bouquets: ['50000000-0000-0000-0000-000000000009'],
    occasion: 'Chúc mừng',
    tags: ['Chúc mừng', 'Thược dược', 'Nhiều màu'],
    isDemoSample: true,
  },
];
