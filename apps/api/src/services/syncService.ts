import { prisma } from '@opspilot/database';
import type { SyncOperationInput } from '@opspilot/validation';
import type { SyncResult } from '@opspilot/types';

export class SyncService {

    // Pulls updates from the server based on the client's last sync timestamp, returning only changed records for efficient data transfer. 
    // If no timestamp is provided, it returns all records.
    static async pullUpdates(organizationId: string, lastSyncedAt: string | null) {
        const cutOffTime = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

        return await prisma.$transaction(async (tx) => {
            const tasks = await tx.task.findMany({
                where: {
                    organizationId,
                    updatedAt: { gt: cutOffTime },
                },
                include: { attachments: true },
            });

            const checklistItems = await tx.checkListItem.findMany({
                where: {
                    task: { organizationId },
                    updatedAt: { gt: cutOffTime },
                },
            });
            return {
                changes: { tasks, checklistItems },
                serverTimestamp: new Date().toISOString(),
            };
        });
    }

    // Pushes client changes to the server with conflict detection and resolution. Returns accepted changes, detected conflicts, and any failures.
    static async processPushOperations(organizationId: string, operations: SyncOperationInput[]): Promise<SyncResult> {
        const result: SyncResult = {
            acceptedIds: [],
            conflicts: [],
            failedIds: []
        };

        for (const op of operations) {
            try {
                switch (op.table) {
                    case 'Task':
                        await this.processTask(organizationId, op as Extract<SyncOperationInput, { table: 'Task' }>, result);
                        break;

                    case 'CheckListItem':
                        await this.processChecklist(organizationId, op as Extract<SyncOperationInput, { table: 'CheckListItem' }>, result);
                        break;
                }
            }
            catch (err: any) {
                console.error(`Error processing operation for ${op.table} with ID ${op.id}:`, err);
                result.failedIds.push({ id: op.id, error: err.message || 'Internal Transaction Boundary Failure' });
            }
        }
        return result;
    }

    // Helper method to process Task operations with conflict detection and idempotent handling for creates, and version-based conflict detection for updates/deletes.
    private static async processTask(organizationId: string, op: Extract<SyncOperationInput, { table: 'Task' }>, result: SyncResult): Promise<void> {
        if (op.action === 'CREATE') {
            const existing = await prisma.task.findFirst({
                where: { id: op.id, organizationId },
            });

            if (existing) {
                result.acceptedIds.push(op.id); // Idempotent handling for already existing record
                return;
            }

            await prisma.task.create({
                data: {
                    id: op.id,
                    title: op.payload.title || 'Untitled',
                    description: op.payload.description || '',
                    status: op.payload.status || 'PENDING',
                    userId: op.payload.assignedUserId || null,
                    organizationId,
                    version: 1 // Enforced server-side versioning for new records
                },
            });
            result.acceptedIds.push(op.id);
            return
        }

        if (op.action === 'UPDATE') {
            const updateBatch = await prisma.task.updateMany({
                where: {
                    id: op.id, organizationId, version: { lte: op.clientVersion },
                },
                data: {
                    ...(op.payload.title !== undefined && { title: op.payload.title }),
                    ...(op.payload.description !== undefined && { description: op.payload.description }),
                    ...(op.payload.status !== undefined && { status: op.payload.status }),
                    ...(op.payload.assignedUserId !== undefined && { userId: op.payload.assignedUserId }),
                    version: { increment: 1 },
                }
            }
            );

            if (updateBatch.count > 0) {
                result.acceptedIds.push(op.id);
                return;
            }

            await this.detectTaskConflictOrFailure(organizationId, op.id, result);
            return;
        }

        if (op.action === 'DELETE') {
            const deleteBatch = await prisma.task.updateMany({
                where: { id: op.id, organizationId, version: { lte: op.clientVersion } },
                data: { isDeleted: true, version: { increment: 1 } }
            });

            if (deleteBatch.count > 0) {
                result.acceptedIds.push(op.id);
                return;
            }

            await this.detectTaskConflictOrFailure(organizationId, op.id, result);
        }
    }

    // Similar logic for checklist items, but with additional parent task existence and ownership validation for creates, and conflict detection for updates/deletes.
    private static async processChecklist(organizationId: string, op: Extract<SyncOperationInput, { table: 'CheckListItem' }>, result: SyncResult): Promise<void> {

        if (op.action === 'CREATE') {
            const existing = await prisma.checkListItem.findUnique({
                where: { id: op.id },
                include: { task: true }
            });

            if (existing) {
                result.acceptedIds.push(op.id); // Idempotent handling for already existing record
                return;
            }

            const parentTask = await prisma.task.findFirst({
                where: { id: op.payload.taskId, organizationId, isDeleted: false },
            });

            if (!parentTask) {
                result.failedIds.push({ id: op.id, error: "Parent task not found or unauthorized cross-tenant attempt" });
                return;
            }

            await prisma.$transaction([
                prisma.checkListItem.create({
                    data: {
                        id: op.id,
                        taskId: op.payload.taskId,
                        content: op.payload.content || '',
                        isCompleted: op.payload.isCompleted || false,
                        version: 1,
                    },
                }),
                prisma.task.update({
                    where: { id: op.payload.taskId },
                    data: { version: { increment: 1 } }, // Signal update changes onto parent node
                }),
            ]);
            result.acceptedIds.push(op.id);
            return;
        }

        const existingItem = await prisma.checkListItem.findFirst({
            where: { id: op.id, task: { organizationId } },
        });

        if (!existingItem) {
            result.failedIds.push({ id: op.id, error: "Target checklist not found or unauthorized " });
            return;
        }

        if (existingItem.version > op.clientVersion) {
            result.conflicts.push({ id: op.id, table: 'CheckListItem', serverRecord: existingItem, });
            return; // Let client handle conflict resolution
        }

        if (op.action === 'UPDATE') {
            await prisma.$transaction([
                prisma.checkListItem.update({
                    where: { id: op.id },
                    data: {
                        ...(op.payload.content !== undefined && {
                            content: op.payload.content,
                        }),
                        ...(op.payload.isCompleted !== undefined && {
                            isCompleted: op.payload.isCompleted,
                        }),
                        version: { increment: 1 },
                    },
                }),
                prisma.task.update({
                    where: { id: existingItem.taskId },
                    data: { version: { increment: 1 } }, // Signal update changes onto parent node
                }),
            ]);
        }
        else if (op.action === 'DELETE') {
            await prisma.$transaction([
                prisma.checkListItem.update({
                    where: { id: op.id },
                    data: {
                        isDeleted: true,
                        version: { increment: 1 },
                    },
                }),
                prisma.task.update({
                    where: { id: existingItem.taskId },
                    data: { version: { increment: 1 } }, // Signal update changes onto parent node
                }),
            ]);
        }
        result.acceptedIds.push(op.id);
    }

    // Helper method to detect if a failed update/delete is due to a conflict or an actual failure (like record not found or cross-tenant access)
    private static async detectTaskConflictOrFailure(organizationId: string, id: string, result: SyncResult): Promise<void> {
        const currentRecord = await prisma.task.findFirst({
            where: { id, organizationId },
        });

        if (!currentRecord) {
            result.failedIds.push({ id, error: "Record not found or unauthorized cross-tenant attempt" });
        }
        else {
            result.conflicts.push({ id, table: 'Task', serverRecord: currentRecord });
        }
    }
}