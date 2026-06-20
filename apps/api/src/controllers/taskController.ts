import type { Request, Response } from 'express';
import { Prisma, prisma } from '@opspilot/database';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createTaskSchema, paramsSchema, bodySchema } from '@opspilot/validation';

// Fetch tasks based on roles(Supervisors see all, workers see only their own)
export const handleGetTasks = asyncHandler(async (req: Request, res: Response) => {
    const { id: userId, role, organizationId } = req.user!;

    const whereClause: Prisma.TaskWhereInput = {
        organizationId,
        isDeleted: false,
    }

    // If the user is a worker, filter tasks by their userId
    if (role === 'WORKER') {
        whereClause.userId = userId;
    }

    const tasks = await prisma.task.findMany({
        where: whereClause,
        include: {
            checkListItems: { where: { isDeleted: false } },
            attachments: true,
        },
        orderBy: {
            updatedAt: 'desc'
        },
    })

    return res.status(200).json(new ApiResponse(200, "Tasks fetched successfully", tasks));
})

// Create a task (with support for client-generated IDs for offline resilience)
export const handleCreateTask = asyncHandler(async (req: Request, res: Response) => {
    const { id, title, description, assignedUserId, checkListItems } = createTaskSchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    const task = await prisma.task.create({
        data: {
            id: id || undefined, // Use provided ID or let Prisma generate one
            title,
            description,
            organizationId,
            userId: assignedUserId || null, // Assign to user if provided, else null
            checkListItems: {
                create: checkListItems?.map(item => ({
                    id: item.id || undefined, // Use provided ID or let Prisma generate one
                    content: item.content,
                })) || [],
            }
        },
        include: {
            checkListItems: true,
        },
    }
    )

    return res.status(201).json(new ApiResponse(201, "Task created successfully", task));
});


export const handleUpdateChecklistItem = asyncHandler(async (req: Request, res: Response) => {
    const {itemId} = paramsSchema.parse(req.params);
    const {isCompleted} = bodySchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    const checklistItem = await prisma.checkListItem.findFirst({
        where: {
            id: itemId,
            task: { organizationId },
        }
    })

    if (!checklistItem) {
        throw new ApiError(404, "Checklist item not found","CHECKLIST_ITEM_NOT_FOUND");
    }

    const updatedItem = await prisma.checkListItem.update({
        where: { id: itemId },
        data: { 
            isCompleted, 
            version: { increment: 1 } 
        },
    })

    return res.status(200).json(new ApiResponse(200, "Checklist item updated successfully", updatedItem));
})