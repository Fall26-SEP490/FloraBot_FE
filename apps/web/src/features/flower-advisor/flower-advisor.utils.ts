import type { FlowerChatMode, FlowerChatPrompt } from './flower-advisor.types';

// Match the API's default and explicit purchase wording. In particular, do not
// send a preorder location or constrain preorder results to the walk-in selector.
export function flowerChatMode(input: FlowerChatPrompt): FlowerChatMode {
  if (input.mode) return input.mode;
  const text = input.question.toLowerCase();
  if (/đặt trước|pre-order|preorder/.test(text)) return 'PREORDER';
  if (/mua ngay|lấy ngay|mua tại tủ|lấy tại tủ|walk-in|walk in/.test(text)) return 'WALK_IN';
  return 'PREORDER';
}
