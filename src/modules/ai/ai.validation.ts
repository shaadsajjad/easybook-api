import { z } from "zod";
import { MAX_HISTORY_ACCEPTED, MAX_MESSAGE_LENGTH } from "./ai.types";

const content = z
  .string({ error: "Message must be text" })
  .trim()
  .min(1, "Message cannot be empty")
  .max(MAX_MESSAGE_LENGTH, `Message must be at most ${MAX_MESSAGE_LENGTH} characters`);

export const chatSchema = z.object({
  message: content,
  // Earlier turns of the conversation (oldest first). Only the last 10 are sent to the AI.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"], { error: 'role must be "user" or "assistant"' }),
        content,
      }),
      { error: "history must be a list of messages" },
    )
    .max(MAX_HISTORY_ACCEPTED, `history can have at most ${MAX_HISTORY_ACCEPTED} messages`)
    .default([]),
});

export type ChatInput = z.infer<typeof chatSchema>;
