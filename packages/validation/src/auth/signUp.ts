import {z} from "zod";

export const signUpSchema = z.object({
    email: z.email({error:"Invalid email address"}),
    password: z.string().min(8, {error:"Password must be at least 8 characters long"}),
    organizationName: z.string().min(2, {error:"Organization name must be at least 2 characters long"}),
    name: z.string().min(2, {error:"Name must be at least 2 characters long"})
})

export type SignUpInput = z.infer<typeof signUpSchema>