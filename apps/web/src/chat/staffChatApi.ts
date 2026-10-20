import { ApiError, request } from '../api';
import { MAX_MESSAGE_LENGTH, uploadChatImage } from './api';
import type {
  ChatTransport,
  SellerStaffChatItem,
  SellerStaffChatMessage,
  SellerStaffChatMessagePage,
  SellerStaffChatPage,
  SellerStaffChatReadResult,
} from './types';

export function validateStaffMessage(content: string, hasImage: boolean): string | null {
  const text = content.trim();
  if (!text && !hasImage) return 'Vui lòng nhập nội dung tin nhắn hoặc đính kèm ảnh.';
  if (text.length > MAX_MESSAGE_LENGTH) return 'Nội dung tin nhắn tối đa 2000 ký tự.';
  return null;
}

export const getStaffChats = (page = 1) =>
  request<SellerStaffChatPage>(`/seller-staff/chats?page=${page}`);
export const openStaffChatForSeller = (sellerId: string, staffId: string) =>
  request<SellerStaffChatItem>(
    `/sellers/${encodeURIComponent(sellerId)}/staff/${encodeURIComponent(staffId)}/chat/open`,
    undefined,
    true,
    'POST',
  );
export const openStaffChatForStaff = () =>
  request<SellerStaffChatItem>('/staff/chats/open', undefined, true, 'POST');
export const getStaffMessages = (chatId: string, page = 1) =>
  request<SellerStaffChatMessagePage>(
    `/seller-staff/chats/${encodeURIComponent(chatId)}/messages?page=${page}`,
  );
export const markStaffChatRead = (chatId: string) =>
  request<SellerStaffChatReadResult>(
    `/seller-staff/chats/${encodeURIComponent(chatId)}/read`,
    undefined,
    true,
    'POST',
  );

export async function sendStaffMessage(
  chatId: string,
  input: { content?: string | null; imageReference?: string | null },
) {
  const content = input.content?.trim() || null;
  const imageReference = input.imageReference?.trim() || null;
  const error = validateStaffMessage(content ?? '', !!imageReference);
  if (error) throw new ApiError(400, error);
  return request<SellerStaffChatMessage>(
    `/seller-staff/chats/${encodeURIComponent(chatId)}/messages`,
    { content, imageReference },
  );
}

export const staffChatTransport: ChatTransport = {
  kind: 'staff',
  getMessages: getStaffMessages,
  markRead: markStaffChatRead,
  send: sendStaffMessage,
  upload: (chatId, file, signal) => uploadChatImage(chatId, file, signal, 'staff'),
  validate: validateStaffMessage,
};
