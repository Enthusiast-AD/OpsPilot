import type { Request, Response } from 'express';
import {prisma} from '@opspilot/database';
import {ApiResponse} from '../utils/ApiResponse.js';
import {ApiError} from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {authCrypto} from '@opspilot/auth';
import {createWorkerSchema} from '@opspilot/validation';

// Get all workers in the organization - only accessible by supervisors
export const handleGetWorkers = asyncHandler(async(req:Request,res:Response)=>{
    const organizationId = req.user!.organizationId;


    const workers = await prisma.user.findMany({
        where:{
            organizationId,
            role:'WORKER'
        },
        select:{
            id:true,
            name:true,
            email:true,
            createdAt:true,
        }
    })

    return res.status(200).json(new ApiResponse(200,"Workers retrieved successfully",{workers}));
})

// Create a new worker in the organization - only accessible by supervisors
export const handleCreateWorker = asyncHandler(async(req:Request,res:Response)=>{
    const {email,password,name} = createWorkerSchema.parse(req.body);
    const organizationId = req.user!.organizationId;

    const hashedPassword = await authCrypto.hashPassword(password);

    const newWorker = await prisma.user.create({
        data:{
            email,
            password:hashedPassword,
            name,
            role:'WORKER',
            organizationId,
        },
        select:{
            id:true,
            name:true,
            email:true,
            role:true,
            createdAt:true,
        }
    })

    return res.status(201).json(new ApiResponse(201,"Worker created successfully",{newWorker}));
})