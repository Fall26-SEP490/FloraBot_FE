import { parseCatalogPage, parseLocations, parsePackages } from './landing-data';
async function getPublicData(path: string): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Chưa tải được dữ liệu. Vui lòng thử lại.');
  return response.json();
}
export const fetchLandingPackages = async () =>
  parsePackages(await getPublicData('/kiosk-packages'));
export const fetchLandingLocations = async () =>
  parseLocations(await getPublicData('/kiosk-locations'));
export async function fetchLandingCatalog(page: number) {
  const result = parseCatalogPage(await getPublicData(`/shop/catalog?page=${page}&search=`));
  if (result.page !== page) throw new Error('Trang catalog trả về không khớp. Hãy thử lại.');
  return result;
}
