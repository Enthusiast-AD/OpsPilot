import type { Request, Response } from 'express';
import * as DocumentService from '../services/documentService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '@opspilot/database';
import { requestDocumentUploadSchema, confirmDocumentUploadSchema, documentParamSchema } from '@opspilot/validation';

export const handleRequestDocLease = asyncHandler(async (req: Request, res: Response) => {
    const {fileName, fileType} = requestDocumentUploadSchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    const uploadInfo = await DocumentService.generateDocumentUploadUrl(organizationId, fileName, fileType);
    return res.status(200).json(new ApiResponse(200,'Document upload URL generated successfully.', uploadInfo));
})

export const handleConfirmDocIngest = asyncHandler(async (req: Request, res: Response) => {
    const {storageKey, title, fileType} = confirmDocumentUploadSchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    try{
        const documentRecord = await DocumentService.verifyAndIngestDocument(organizationId, storageKey, title, fileType);
        return res.status(201).json(new ApiResponse(201,'Document ingested successfully.', documentRecord));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred while ingesting the document.';
        throw new ApiError(400, message, 'DOCUMENT_INGEST_ERROR');
    }
})

export const handleListDocuments = asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.user!.organizationId;

    const documents = await prisma.document.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
    });
    
    return res.status(200).json(new ApiResponse(200, 'Documents retrieved successfully.', documents));
})

export const handleDeleteDocument = asyncHandler(async (req: Request, res: Response) => {
    const {id} = documentParamSchema.parse(req.params);
    const organizationId = req.user!.organizationId;

    try {
        await DocumentService.removeDocument(organizationId, id);
        return res.status(200).json(new ApiResponse(200, 'Document deleted successfully.', null));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred while deleting the document.';
        throw new ApiError(400, message, 'DOCUMENT_DELETE_ERROR');
    }
})
