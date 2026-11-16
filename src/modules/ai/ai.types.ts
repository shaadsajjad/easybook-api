export const MAX_MESSAGE_LENGTH = 500;
// Older messages are dropped so the prompt (and the cost) stays small.
export const MAX_HISTORY_MESSAGES = 10;
// The app may send a longer history; anything beyond this many items is rejected outright.
export const MAX_HISTORY_ACCEPTED = 50;
export const PROVIDER_TIMEOUT_MS = 15_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SuggestedService {
  id: string;
  name: string;
}

export interface ChatReply {
  reply: string;
  suggestedServices: SuggestedService[];
}

// What the assistant knows about each service (loaded from the database on every request).
export interface ServiceContext {
  id: string;
  name: string;
  description: string;
  price: string;
  durationMinutes: number;
  category: string;
}
