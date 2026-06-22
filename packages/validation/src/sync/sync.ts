import { z } from "zod";

export const syncPullSchema = z.object({
    lastSyncedAt: z.iso.datetime({ error: "Invalid ISO timestamp format" }).nullable(),
}).strict();

const taskPayloadSchema = z.object({
    title: z.string().trim().min(4, { error: "Title cannot be empty" }).max(200, { error: "Title cannot exceed 200 characters" }).optional(),
    description: z.string().trim().min(10, { error: "Description cannot be empty" }).max(500, { error: "Description cannot exceed 500 characters" }).optional(),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ESCALATED"]).optional(),
    assignedUserId: z.uuid({ error: "Invalid UUID format" }).nullable().optional(),
}).strict();

const checklistPayloadSchema = z.object({
    taskId: z.uuid({ error: "Invalid UUID format" }),
    content: z.string().trim().min(1, { error: "Content cannot be empty" }).max(500, { error: "Content cannot exceed 500 characters" }).optional(),
    isCompleted: z.boolean().optional(),
}).strict();

export const syncOperationSchema = z.discriminatedUnion('table', [
    z.object({
        id: z.uuid(),
        table: z.literal('Task'),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
        clientVersion: z.number().int().positive(),
        clientTimestamp: z.iso.datetime({ error: "Invalid ISO timestamp format" }),
        payload: taskPayloadSchema,
    }).strict(),
    z.object({
        id: z.uuid(),
        table: z.literal('CheckListItem'),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
        clientVersion: z.number().int().positive(),
        clientTimestamp: z.iso.datetime({ error: "Invalid ISO timestamp format" }),
        payload: checklistPayloadSchema,
    }).strict(),
]);

export const syncPushSchema = z.object({
    operations: z.array(syncOperationSchema),
}).strict();

export type SyncPullInput = z.infer<typeof syncPullSchema>;
export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
export type SyncPushInput = z.infer<typeof syncPushSchema>;