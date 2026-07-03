import z from 'zod';

export const AllowedDocumentMimeTypes = z.enum([
    'application/pdf',
    'text/plain',
]);

const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50 MB

export const requestDocumentUploadSchema = z.object({
    fileName: z.string().trim().min(1, {error: 'File name is required'}).max(255, {error: 'File name must be less than 255 characters'}),
    fileType: AllowedDocumentMimeTypes,
    fileSize: z.number().positive().max(MAX_DOCUMENT_SIZE, {error: 'File size must be less than 50 MB'}),
}).strict();

export const confirmDocumentUploadSchema = z.object({
    storageKey: z.string().trim().min(1, {error: 'Storage key is required'}),
    title: z.string().trim().min(3, {error: 'Title is required'}).max(255, {error: 'Title must be less than 255 characters'}),
    fileType: AllowedDocumentMimeTypes,
    fileSize: z.number().positive().max(MAX_DOCUMENT_SIZE, {error: 'File size must be less than 50 MB'}),
}).strict();

export const documentParamSchema = z.object({
    id: z.uuid({error: 'Invalid document ID'}),
}).strict();