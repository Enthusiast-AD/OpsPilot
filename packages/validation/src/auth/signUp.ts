import {z} from "zod";

export const signUpSchema = z.object({
    email: z.email({message:"Invalid email address"}),
    password: z.string().min(8, {message:"Password must be at least 8 characters long"}),
    organizationName: z.string().min(2, {message:"Organization name must be at least 2 characters long"}),
    name: z.string().min(2, {message:"Name must be at least 2 characters long"})
})

export type SignUpInput = z.infer<typeof signUpSchema>