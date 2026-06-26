import {z} from "zod";

export const AllowedAttachmentTypes = z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
]);

const MAX_SIZE_BY_TYPE: Record<z.infer<typeof AllowedAttachmentTypes>, number> = {
    "image/jpeg": 25 * 1024 * 1024, // 25MB
    "image/png": 25 * 1024 * 1024, // 25MB
    "image/webp": 25 * 1024 * 1024, // 25MB
    "application/pdf": 50 * 1024 * 1024, // 50MB
};

export const requestUploadUrlSchema = z.object({
    fileName: z.string().trim().min(1, {error: "File name is required"}).max(255, {error: "File name must be less than 255 characters"}),
    fileType: AllowedAttachmentTypes,
    fileSize: z.number().positive(),
}).strict().superRefine((data, ctx) => {
    const maxSize = MAX_SIZE_BY_TYPE[data.fileType];
    if (data.fileSize > maxSize) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fileSize"],
            message: `File size must be less than ${maxSize / (1024 * 1024)}MB for type ${data.fileType}`,
        });
    }
});

export const confirmUploadSchema = z.object({
    storageKey: z.string().trim().min(1, {error: "Storage key is required"}),
    fileName: z.string().trim().min(1, {error: "File name is required"}).max(255, {error: "File name must be less than 255 characters"}),
    fileType: AllowedAttachmentTypes,
    fileSize: z.number().positive(),
}).strict();

export const attachmentParamSchema = z.object({
    id: z.uuid("Invalid attachment ID"),
}).strict();

export const taskIdParamSchema = z.object({
    taskId: z.uuid("Invalid task ID"),
}).strict();

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;