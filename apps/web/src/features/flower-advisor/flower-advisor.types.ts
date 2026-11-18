export type FlowerChatMode = 'PREORDER' | 'WALK_IN';

export type FlowerChatInput = {
  question: string;
  mode?: FlowerChatMode;
  budget?: number;
  kioskId?: string;
  latitude?: number;
  longitude?: number;
};

export type FlowerChatSuggestion = {
  id: string;
  productId: string;
  kioskId: string;
  mode: FlowerChatMode;
  name: string;
  price: number;
  reason: string;
  photo: string | null;
  shopName: string | null;
  kioskName: string | null;
  distanceKm: number | null;
  productRating: number | null;
  productReviews: number;
  shopRating: number | null;
  shopReviews: number;
};

export type FlowerChatAnswer = {
  intent: 'FLOWERS' | 'OFF_TOPIC' | 'UNAVAILABLE';
  message: string;
  suggestions: FlowerChatSuggestion[];
};

export type FlowerChatPrompt = Pick<FlowerChatInput, 'question' | 'mode' | 'budget'>;
