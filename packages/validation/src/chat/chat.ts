import {z} from "zod";

export const saveChatSchema = z.object({
  question: z.string().trim().min(1, {error: "Question is required"}).max(2000, {error: "Question must be less than 2000 characters"}),
  answer: z.string().trim().min(1, {error: "Answer is required"}),
  confidence: z.number().min(0.0).max(1.0, {error: "Confidence must be between 0.0 and 1.0"})
}).strict();

export const chatIdParamSchema = z.object({
  id: z.uuid({error: "Invalid chat ID format"})
});