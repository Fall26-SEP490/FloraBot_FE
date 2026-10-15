import type { components } from '../../../../packages/contracts/src/generated/api';

export type CustomerSellerChatItem = components['schemas']['CustomerSellerChatItem'];
export type CustomerSellerChatPage = components['schemas']['CustomerSellerChatPage'];
export type CustomerSellerChatMessage = components['schemas']['CustomerSellerChatMessage'];
export type CustomerSellerChatMessagePage = components['schemas']['CustomerSellerChatMessagePage'];
export type CustomerSellerChatMessageInput =
  components['schemas']['CustomerSellerChatMessageInput'];
export type CustomerSellerChatReadResult = components['schemas']['CustomerSellerChatReadResult'];
export type OpenCustomerSellerChatInput = components['schemas']['OpenCustomerSellerChatInput'];
export type EvidenceUploadResponse = components['schemas']['EvidenceUploadResponse'];

export interface ChatMessageReceivedEvent {
  chatId: string;
  id: string;
  senderName: string;
  senderRole: 'CUSTOMER' | 'SELLER' | string;
  content: string | null;
  createdAt: string;
  imageUrl: string | null;
  unreadCount: number;
}

export interface ChatMessagesReadEvent {
  chatId: string;
  readerName: string;
  readerRole: 'CUSTOMER' | 'SELLER' | string;
  readThroughMessageId: string;
  readThroughCreatedAt: string;
  readAt: string;
  messagesMarkedRead: number;
}
