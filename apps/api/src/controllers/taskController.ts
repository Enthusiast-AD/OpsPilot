import type { Request, Response } from 'express';
import { Prisma, prisma } from '@opspilot/database';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { 
    createTaskSchema,
    paramsSchema,
    toggleChecklistBodySchema,
    updateTaskSchema,
    escalateTaskSchema, 
    taskIdParamSchema
} from '@opspilot/validation';

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

    // If an assignedUserId is provided, ensure that the user exists in the same organization
    if (assignedUserId) {
        const assignedUser = await prisma.user.findFirst({
            where: {
                id: assignedUserId,
                organizationId,
            }
        })

        if(!assignedUser){
            throw new ApiError(400, "Assigned user does not exist in the organization","ASSIGNED_USER_NOT_FOUND");
        }
    }

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
                })) ?? []
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
    const {id} = paramsSchema.parse(req.params);
    const {isCompleted} = toggleChecklistBodySchema.parse(req.body);
    const {organizationId, role, id: userId} = req.user!;

    const checklistItem = await prisma.checkListItem.findFirst({
        where: {
            id,
            task: { 
                organizationId, 
                isDeleted: false,
                ...(role === 'WORKER' ? { userId } : {}) // Workers can only update checklist items of their own tasks
             },
        }
    })

    if (!checklistItem) {
        throw new ApiError(404, "Checklist item not found","CHECKLIST_ITEM_NOT_FOUND");
    }

    const [updatedItem] = await prisma.$transaction([
        prisma.checkListItem.update({
            where: { id },
            data: { isCompleted, version: {increment: 1} } // Increment version for optimistic concurrency control
        }),
        prisma.task.update({
            where: { id: checklistItem.taskId },
            data: { version: {increment: 1} } // Increment parent task's version as well
        }),
    ])

    return res.status(200).json(new ApiResponse(200, "Checklist item updated successfully", updatedItem));
})

// Fetch a single task by ID with access control
export const handleGetTaskById = asyncHandler(async (req: Request, res: Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const {organizationId, role, id: userId} = req.user!;

    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            organizationId,
            isDeleted: false,
        },
        include: {
            checkListItems:{where: {isDeleted: false}},
            attachments: true,
        }
    })

    if (!task) {
        throw new ApiError(404, "Task not found","TASK_NOT_FOUND");
    }

    // If the user is a worker, ensure they can only access their own tasks
    if (role === 'WORKER' && task.userId !== userId) {
        throw new ApiError(403, "You do not have permission to access this task","FORBIDDEN");
    }

    return res.status(200).json(new ApiResponse(200, "Task fetched successfully", task));
})

// Update a task with optimistic concurrency control
export const handleUpdateTask = asyncHandler(async (req:Request, res:Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const {title, description, status, assignedUserId} = updateTaskSchema.parse(req.body);

    const organizationId = req.user!.organizationId;

    const existingTask = await prisma.task.findFirst({
        where: {
            id: taskId,
            organizationId,
            isDeleted: false,
        }
    })
    
    if (!existingTask) {
        throw new ApiError(404, "Task not found","TASK_NOT_FOUND");
    }

    // If an assignedUserId is provided, ensure that the user exists in the same organization
    if (assignedUserId) {
        const assignedUser = await prisma.user.findFirst({
            where: {
                id: assignedUserId,
                organizationId,
            }
        })

        if(!assignedUser){
            throw new ApiError(400, "Assigned user does not exist in the organization","ASSIGNED_USER_NOT_FOUND");
        }
    }

    const updatedTask = await prisma.task.update({
        where: {id: taskId},
        data:{
            title: title ?? existingTask.title,
            description: description ?? existingTask.description,
            status: status ?? existingTask.status,
            userId: assignedUserId ?? existingTask.userId,
            version: {increment: 1} // Increment version for optimistic concurrency control
        }
    })

    return res.status(200).json(new ApiResponse(200, "Task updated successfully", updatedTask));
})

// Delete a task (soft delete)
export const handleDeleteTask = asyncHandler(async (req: Request, res: Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const organizationId = req.user!.organizationId;

    const existingTask = await prisma.task.findFirst({
        where:{
            id: taskId,
            organizationId,
            isDeleted: false,
        }
    })
    if(!existingTask){
        throw new ApiError(404, "Task not found","TASK_NOT_FOUND");
    }

    await prisma.task.update({
        where: {id: taskId},
        data: {
            isDeleted: true, 
            version: {increment: 1} // Soft delete and increment version
        } 
    })

    return res.status(200).json(new ApiResponse(200, "Task deleted successfully", null));
})

// Trigger Human Escalation for a task
export const handleEscalateTask = asyncHandler(async (req: Request, res: Response) => {
    const {taskId} = taskIdParamSchema.parse(req.params);
    const {reason, aiChatId} = escalateTaskSchema.parse(req.body);
    const {organizationId, id: userId, role} = req.user!;

    // Fetch the task to ensure it exists and belongs to the organization
    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            organizationId,
            isDeleted: false,
            ...(role === 'WORKER' ? { userId } : {}) // Workers can only escalate their own tasks
        }
    })

    if (!task) {
        throw new ApiError(404, "Task not found","TASK_NOT_FOUND");
    }

    // Check if there's already an active escalation for this task
    const activeEscalation = await prisma.escalation.findFirst({
        where: {
            taskId: taskId,
            status: {in: ['OPEN', 'IN_REVIEW'] } // Check for active escalations
        }
    })

    if(activeEscalation){
        throw new ApiError(400, "This task is already undergoing supervisor evaluation","DUPLICATE_ESCALATION");
    }

    if(aiChatId){
        // Validate that the provided AI Chat ID exists and belongs to the user
        const aiChat = await prisma.aiChat.findFirst({
            where: { id: aiChatId, userId }
        });

        if(!aiChat){
            throw new ApiError(400, "Invalid AI Chat ID or it does not belong to the user","INVALID_AI_CHAT_ID");
        }
    }

    // create a escalation record in the database and flip parent task's status to "ESCALATED"
    const escalation = await prisma.$transaction(async (tx) => {
        await tx.task.update({
            where: { id: taskId },
            data: { status: "ESCALATED", version: {increment: 1} } // Increment version for optimistic concurrency control
        })

        return tx.escalation.create({
            data: {
                taskId: taskId,
                reason: reason || "Worker requested human intervention",
                aiChatId: aiChatId || null,
                status: "OPEN",
            }
        })
    })

    return res.status(201).json(new ApiResponse(201, "Task escalated successfully", escalation));
})