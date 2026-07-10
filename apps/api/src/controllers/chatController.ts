import type { Request, Response } from 'express';
import * as ChatService from '../services/chatService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveChatSchema } from '@opspilot/validation';

export const handleSaveChatInteraction = asyncHandler(async (req: Request, res: Response) => {
    const {id: userId} = req.user!;
    const {question, answer, confidence} = saveChatSchema.parse(req.body);

    const savedLog = await ChatService.archiveChatInteraction(userId, question, answer, confidence);

    return res.status(201).json(new ApiResponse(200,'AI conversation checkpoint recorded', savedLog));
})

export const handleGetMyChatHistory = asyncHandler(async (req: Request, res: Response) => {
    const {id: userId} = req.user!;

    const historicalLogs = await ChatService.getOperatorChatHistory(userId);

    return res.status(200).json(new ApiResponse(200,'AI conversation history retrieved', historicalLogs));
})