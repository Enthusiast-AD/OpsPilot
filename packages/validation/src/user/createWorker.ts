import {z} from 'zod';

export const createWorkerSchema = z.object({
  email: z.email({error:"Invalid email address"}).transform(email=>email.trim().toLowerCase()),
  password: z.string().min(8, {error:"Password must be at least 8 characters long"}),
  name: z.string().min(2, {error:"Name required"}).max(100, {error:"Name must be less than 100 characters"}),
});

export type CreateWorker = z.infer<typeof createWorkerSchema>;