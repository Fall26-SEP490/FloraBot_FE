import { request } from '../../api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import type {
  ProductItem,
  CreateProductInput,
  UpdateProductMetadataInput,
  SellerKiosk,
  PhotoPage,
} from './product.types';

export const fetchProducts = () => request<ProductItem[]>('/me/products');

export const fetchSellerKiosks = (sellerId: string) =>
  request<SellerKiosk[]>(`/sellers/${sellerId}/kiosks`);

export const updateProductPrice = (sellerId: string, productId: string, price: number) =>
  request(`/sellers/${sellerId}/flows/update_product_price`, {
    p_product: productId,
    p_price: price,
  } satisfies components['schemas']['UpdateProductPriceRequest']);

export const setProductStatus = (productId: string, status: string) =>
  request('/me/flows/set_product_status', {
    productId,
    status,
  } satisfies components['schemas']['SetProductStatusRequest']);

export const postProduct = (body: CreateProductInput) =>
  request<{ id: string }>('/me/products', body);

export const putProduct = (sellerId: string, productId: string, body: UpdateProductMetadataInput) =>
  request<{ id: string }>(`/sellers/${sellerId}/products/${productId}`, body, true, 'PUT');

export const fetchProductPhotos = (productId: string, page: number) =>
  request<PhotoPage>(`/me/products/${productId}/photos?page=${page}`);
