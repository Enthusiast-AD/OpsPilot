import type { Request, Response } from 'express';
import * as AttachmentService from '../services/attachmentService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '@opspilot/database';
import { requestUploadUrlSchema, confirmUploadSchema, attachmentParamSchema, taskIdParamSchema} from '@opspilot/validation';

async function verifyTaskOwnership(organizationId: string, taskId: string, role: 'SUPERVISOR' | 'WORKER', userId: string) {
    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            organizationId,
            isDeleted: false,
        },
    });

    if (!task) {
        throw new ApiError(404, 'Task not found', 'TASK_NOT_FOUND');
    }
    
    if (role === 'WORKER' && task.userId !== userId) {
        throw new ApiError(403, 'You do not have permission to modify this task', 'FORBIDDEN');
    }
}

export const handleGenerateUploadRequest = asyncHandler(async (req: Request, res: Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const { fileName, fileType } = requestUploadUrlSchema.parse(req.body);
    const { organizationId, role, id: userId }= req.user!;

    await verifyTaskOwnership(organizationId, taskId, role, userId);

    const uploadInfo = await AttachmentService.generateUploadUrl(organizationId, taskId, fileName, fileType);

    return res.status(200).json(new ApiResponse(200, 'Secure write signature allocated', uploadInfo));
})

export const handleConfirmUpload = asyncHandler(async (req: Request, res: Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const { storageKey, fileName, fileType, fileSize } = confirmUploadSchema.parse(req.body);
    const { organizationId, role, id: userId }= req.user!;
    
    await verifyTaskOwnership(organizationId, taskId, role, userId);

    try{
        const record = await AttachmentService.verifyAndRecordAttachment(organizationId, taskId, storageKey, fileName, fileType, fileSize);
        return res.status(201).json(new ApiResponse(201, 'Attachment verified and recorded successfully', record));
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database write cancellation encountered';
        throw new ApiError(400, msg, 'VERIFICATION_FAILED');
    }
})

export const handleGetTaskAttachments = asyncHandler(async (req: Request, res: Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const { organizationId, role, id: userId }= req.user!;
    
    await verifyTaskOwnership(organizationId, taskId, role, userId);

    const attachments = await prisma.attachment.findMany({
        where: {
            taskId,
        },
    });

    return res.status(200).json(new ApiResponse(200, 'Attachments retrieved successfully', attachments));
})

export const handleDeleteAttachment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = attachmentParamSchema.parse(req.params);
    const organizationId = req.user!.organizationId;

    try {
        await AttachmentService.removeAttachment(organizationId, id);
        return res.status(200).json(new ApiResponse(200, 'Attachment deleted successfully', null));
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete attachment';
        throw new ApiError(404, msg, 'ATTACHMENT_DELETE_FAILED');
    }
});