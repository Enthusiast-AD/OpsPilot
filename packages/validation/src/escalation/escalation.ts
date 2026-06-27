import {z} from 'zod';

export const escalationStatusEnum = z.enum(['OPEN','IN_REVIEW','RESOLVED']);

export const updateEscalationSchema = z.object({
    status: escalationStatusEnum.optional(),
    supervisorNotes: z.string().trim().max(5000,{error:'Supervisor notes must be less than 5000 characters'}).optional(),
    updateTaskStatus: z.enum(['PENDING','IN_PROGRESS','COMPLETED']).optional()
}).strict().superRefine((data, ctx) => {
    // Ensure that at least one of the fields is provided for update
    if(!data.status && !data.supervisorNotes && !data.updateTaskStatus){
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'At least one field must be provided for update'
        });
    }
});

export const escalationParamsSchema = z.object({
    id: z.uuid({error:'Escalation ID must be a valid UUID'})
}).strict();

export const escalationQuerySchema = z.object({
    status: escalationStatusEnum.optional(),
}).strict();

export type UpdateEscalationInput = z.infer<typeof updateEscalationSchema>;