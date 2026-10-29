import { ApiError, request } from '@/shared/lib/api';
import type {
  CustomerSellerChatItem,
  CustomerSellerChatMessage,
  CustomerSellerChatMessagePage,
  CustomerSellerChatPage,
  CustomerSellerChatReadResult,
  EvidenceUploadResponse,
  OpenCustomerSellerChatInput,
  ChatTransport,
} from './types';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const emailRegex = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i;
const linkRegex =
  /\b(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+(?:com|vn|net|org|io|co|edu|gov|app|dev|shop|store|info|biz|me|ly|gg|link|online|site|xyz)(?:\/\S*)?/i;
const phoneRegex =
  /(?<![A-Za-z0-9])0[2-9](?:[\s().-]*\d){8}(?![A-Za-z0-9])|(?<![A-Za-z0-9])\+?84[2-9](?:[\s().-]*\d){7}(?![A-Za-z0-9])|(?<![A-Za-z0-9])\+[1-9](?:[\s().-]*\d){7,14}(?![A-Za-z0-9])/;

export function containsContactInfo(text: string): boolean {
  return emailRegex.test(text) || linkRegex.test(text) || phoneRegex.test(text);
}

export function validateMessageContent(content: string, hasImage: boolean): string | null {
  const trimmed = content.trim();
  if (!trimmed && !hasImage) {
    return 'Vui lòng nhập nội dung tin nhắn hoặc đính kèm ảnh.';
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return `Nội dung tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự (hiện tại: ${trimmed.length}).`;
  }
  if (trimmed && containsContactInfo(trimmed)) {
    return 'Tin nhắn không được chứa email, số điện thoại hoặc đường dẫn.';
  }
  return null;
}

export function validateChatImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Định dạng ảnh không được hỗ trợ. Chỉ nhận ảnh PNG, JPEG hoặc WebP.';
  }
  if (file.size === 0) {
    return 'File ảnh không có dữ liệu.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Ảnh vượt quá kích thước 5 MB cho phép.';
  }
  return null;
}

export async function openCustomerChat(
  input: OpenCustomerSellerChatInput,
): Promise<CustomerSellerChatItem> {
  return request<CustomerSellerChatItem>('/member/chats/open', input, true, 'POST');
}

export async function getCustomerChats(page = 1): Promise<CustomerSellerChatPage> {
  return request<CustomerSellerChatPage>(`/member/chats?page=${page}`, undefined, true, 'GET');
}

export async function getCustomerUnreadCount(signal?: AbortSignal): Promise<number> {
  const unreadByChat = new Map<string, number>();
  for (let page = 1; page <= 100000; page++) {
    signal?.throwIfAborted();
    const result = await getCustomerChats(page);
    signal?.throwIfAborted();
    for (const chat of result.items) {
      unreadByChat.set(chat.id, Number(chat.unreadCount ?? 0));
    }
    if (!result.hasMore) {
      return [...unreadByChat.values()].reduce((sum, count) => sum + count, 0);
    }
    if (!result.items.length) break;
  }
  throw new Error('Chưa tải đủ danh sách hội thoại.');
}

export async function getSellerChats(sellerId: string, page = 1): Promise<CustomerSellerChatPage> {
  return request<CustomerSellerChatPage>(
    `/sellers/${encodeURIComponent(sellerId)}/chats?page=${page}`,
    undefined,
    true,
    'GET',
  );
}

export async function getChatMessages(
  chatId: string,
  page = 1,
): Promise<CustomerSellerChatMessagePage> {
  return request<CustomerSellerChatMessagePage>(
    `/chats/${encodeURIComponent(chatId)}/messages?page=${page}`,
    undefined,
    true,
    'GET',
  );
}

export async function uploadChatImage(
  chatId: string,
  file: File,
  signal?: AbortSignal,
  channel: 'customer' | 'staff' = 'customer',
): Promise<EvidenceUploadResponse> {
  const validationError = validateChatImageFile(file);
  if (validationError) {
    const status = file.size > MAX_IMAGE_BYTES ? 413 : 415;
    throw new ApiError(status, validationError);
  }

  const combinedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(40_000)])
    : AbortSignal.timeout(40_000);

  const endpoint = `/api/${channel === 'staff' ? 'seller-staff/chats' : 'chats'}/${encodeURIComponent(chatId)}/images`;
  const requestInit: RequestInit = {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
    signal: combinedSignal,
  };

  let response = await fetch(endpoint, requestInit);
  if (response.status === 401) {
    try {
      const refreshed = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      if (refreshed.ok) {
        response = await fetch(endpoint, requestInit);
      }
    } catch {
      /* Preserve original 401 handling */
    }
  }

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
      message?: string;
    };
    const detail = problem.detail || problem.error || problem.message;

    if (response.status === 400) {
      throw new ApiError(400, detail || 'Dữ liệu ảnh không hợp lệ.');
    }
    if (response.status === 401) {
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (response.status === 403) {
      throw new ApiError(403, 'Bạn không có quyền tải ảnh vào cuộc trò chuyện này.');
    }
    if (response.status === 404) {
      throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện để tải ảnh.');
    }
    if (response.status === 413) {
      throw new ApiError(413, 'Ảnh vượt quá kích thước 5 MB cho phép.');
    }
    if (response.status === 415) {
      throw new ApiError(415, 'Định dạng ảnh không được hỗ trợ. Chỉ nhận PNG, JPEG hoặc WebP.');
    }
    if (response.status === 429) {
      throw new ApiError(429, 'Bạn thao tác quá nhanh. Hãy thử lại sau giây lát.');
    }
    if (response.status === 503) {
      throw new ApiError(503, 'Kho ảnh chat hiện chưa sẵn sàng. Vui lòng thử lại sau.');
    }

    throw new ApiError(
      response.status,
      detail || 'Chưa lưu được ảnh. Kiểm tra kết nối và thử lại.',
    );
  }

  const data = (await response.json().catch(() => ({}))) as EvidenceUploadResponse;
  if (!data?.reference?.startsWith('evidence:v1:')) {
    throw new ApiError(500, 'Mã tham chiếu ảnh tải lên không hợp lệ.');
  }
  return data;
}

export async function sendChatMessage(
  chatId: string,
  input: { content?: string | null; imageReference?: string | null },
): Promise<CustomerSellerChatMessage> {
  const content = input.content ? input.content.trim() : null;
  const imageReference = input.imageReference ? input.imageReference.trim() : null;

  const validationError = validateMessageContent(content || '', Boolean(imageReference));
  if (validationError) {
    throw new ApiError(400, validationError);
  }

  return request<CustomerSellerChatMessage>(
    `/chats/${encodeURIComponent(chatId)}/messages`,
    {
      content: content || null,
      imageReference: imageReference || null,
    },
    true,
    'POST',
  );
}

export async function markChatAsRead(chatId: string): Promise<CustomerSellerChatReadResult> {
  return request<CustomerSellerChatReadResult>(
    `/chats/${encodeURIComponent(chatId)}/read`,
    undefined,
    true,
    'POST',
  );
}

export const customerChatTransport: ChatTransport = {
  kind: 'customer',
  getMessages: getChatMessages,
  markRead: markChatAsRead,
  send: sendChatMessage,
  upload: uploadChatImage,
  validate: validateMessageContent,
};

export function formatChatError(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.status) {
      case 400:
        return cause.message || 'Yêu cầu hoặc nội dung gửi không hợp lệ.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền tham gia cuộc trò chuyện này.';
      case 404:
        return 'Cuộc trò chuyện hoặc đối phương không tồn tại.';
      case 409:
        return 'Xung đột khi gửi tin nhắn hoặc ảnh. Vui lòng thử lại.';
      case 413:
        return 'Ảnh đính kèm vượt quá dung lượng tối đa 5 MB.';
      case 415:
        return 'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận PNG, JPEG hoặc WebP.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.';
      case 503:
        return 'Dịch vụ chat hoặc kho lưu trữ tạm thời gián đoạn. Vui lòng thử lại sau.';
      default:
        return cause.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
    }
  }
  if (cause instanceof Error) {
    if (cause.name === 'AbortError') {
      return 'Quá trình gửi bị hủy hoặc hết thời gian chờ.';
    }
    return cause.message;
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
