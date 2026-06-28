import {prisma, ESCALATION_STATUS, TASK_STATUS} from '@opspilot/database';

// Retrieves all escalations for a given organization, optionally filtered by status
export async function getOrganizationEscalations(organizationId: string, statusFilter?: ESCALATION_STATUS) {
    return await prisma.escalation.findMany({
        where: {
            task: {
                organizationId,
                isDeleted: false,
            },
            ...(statusFilter && { status: statusFilter }), // Apply status filter if provided
        },
        include: {
            task: {
                select: {
                    id: true,
                    title: true,
                    status: true,
                    userId: true, // Include userId to identify the user associated with the task
                },
            },
            aiChat: {
                select: {
                    question: true,
                    answer: true,
                    confidence: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        });
}

// Modifies the state of an escalation, including its status, supervisor notes, and optionally the associated task's status. 
// Ensures that the escalation belongs to the specified organization and is not already resolved.
export async function modifyEscalationState(organizationId: string, escalationId: string, supervisorId: string, status?: ESCALATION_STATUS, supervisorNotes?: string, updateTaskStatus?: TASK_STATUS) {
    // Use a transaction to ensure atomicity of the operations
    return await prisma.$transaction(async (tx) => {
        // Fetch the escalation to ensure it exists and belongs to the specified organization
        const target = await tx.escalation.findFirst({
            where: {
                id: escalationId,
                task: {
                    organizationId,
                    isDeleted: false,
                },
            },
            select:{
                taskId: true,
                status: true,
            }
        });
        
        if(!target) {
            throw new Error('Escalation not found or does not belong to the specified organization.');
        }

        // Prevent modifications to escalations that are already resolved
        if(target.status === ESCALATION_STATUS.RESOLVED) {
            throw new Error('Cannot modify a resolved escalation.');
        }

        // Update the escalation with the new status and supervisor notes
        const updateEscalation = await tx.escalation.update({
            where: { id: escalationId },
            data: {
                status: status ?? undefined,
                supervisorNotes,
                resolvedById: status === ESCALATION_STATUS.RESOLVED ? supervisorId : undefined,
            },
        });

        // Update the associated task's status if a new status is provided
        // or if the escalation is resolved
        if(updateTaskStatus) {
            await tx.task.update({
                where: { id: target.taskId },
                data: {
                    status: updateTaskStatus,
                    version: { increment: 1 }, // Increment the version to reflect the update
                },
            });
        } else if (status === ESCALATION_STATUS.RESOLVED) {
            // If the escalation is resolved and no specific task status is provided,
            // set the task status to IN_PROGRESS by default
            await tx.task.update({
                where: { id: target.taskId },
                data: {
                    status: TASK_STATUS.IN_PROGRESS, 
                    version: { increment: 1 }, // Increment the version to reflect the update
                },
            });
        }

        return updateEscalation;
    })
}