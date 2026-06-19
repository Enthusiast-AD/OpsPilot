import {z} from "zod";

export const loginSchema = z.object({
    email: z.email({error:"Invalid email address"}).transform(email=>email.trim().toLowerCase()),
    password: z.string().min(1, {error:"Password is required"})
})

export type LoginInput = z.infer<typeof loginSchema>