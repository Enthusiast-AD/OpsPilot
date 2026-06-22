import type {Request, Response} from 'express';
import { SyncService } from '../services/syncService.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { syncPullSchema, syncPushSchema } from '@opspilot/validation';

export const handleSyncPull = asyncHandler(async (req: Request, res: Response) => {
    const { lastSyncedAt } = syncPullSchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    const data = await SyncService.pullUpdates(organizationId, lastSyncedAt);
    
    return res.status(200).json(new ApiResponse(200, 'Sync pull successful', data));
});

export const handleSyncPush = asyncHandler(async (req: Request, res: Response) => {
    const { operations } = syncPushSchema.parse(req.body);
    const organizationId = req.user!.organizationId;
    
    const result = await SyncService.processPushOperations(organizationId, operations);

    return res.status(200).json(new ApiResponse(200, 'Sync push processed', result));
});