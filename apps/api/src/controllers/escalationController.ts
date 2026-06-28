import type { Request, Response } from 'express';
import * as EscalationService from '../services/escalationService.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import {ApiError} from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {escalationParamsSchema, escalationQuerySchema, updateEscalationSchema} from '@opspilot/validation'
import {ESCALATION_STATUS, TASK_STATUS} from '@opspilot/database';

export const handleGetEscalations = asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;
    const {status} = escalationQuerySchema.parse(req.query);

    const list = await EscalationService.getOrganizationEscalations(organizationId, status as ESCALATION_STATUS);
    return res.status(200).json(new ApiResponse(200,'Escalations retrieved successfully.', list));
})

export const handleUpdateEscalation = asyncHandler(async (req: Request, res: Response) => {
    const {id} = escalationParamsSchema.parse(req.params);
    const {status, supervisorNotes, updateTaskStatus} = updateEscalationSchema.parse(req.body);
    const organizationId = req.user!.organizationId;
    const supervisorId = req.user!.id;

    try{
        const updatedRecord = await EscalationService.modifyEscalationState(organizationId, id, supervisorId, status as ESCALATION_STATUS, supervisorNotes, updateTaskStatus as TASK_STATUS);
        return res.status(200).json(new ApiResponse(200,'Escalation updated successfully.', updatedRecord));
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'State Machine mutation rejected';
        throw new ApiError(400, errMsg, 'ESCALATION_UPDATE_ERROR');
})