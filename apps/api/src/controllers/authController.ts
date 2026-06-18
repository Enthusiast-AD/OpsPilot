import type { Request, Response } from 'express';
import {prisma} from '@opspilot/database';
import {authCrypto} from '@opspilot/auth';
import {ApiResponse} from '../utils/ApiResponse.js';
import {ApiError} from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {type SignUpInput, type LoginInput, signUpSchema, loginSchema} from '@opspilot/validation';

export const handleSignUp = asyncHandler(async(req:Request,res:Response)=>{
    const {email,password,organizationName,name} = signUpSchema.parse(req.body);
    const emailNormalized = email.trim().toLowerCase();
    const hashedPassword = await authCrypto.hashPassword(password); 

    // using a transaction to ensure that the user creation and organization creation are atomic
    const result  = await prisma.$transaction(async (tx)=>{

        // Organization must exist before creating the user because
        // organizationId is a foreign key.
        const newOrganization = await tx.organization.create({
            data:{
                name:organizationName
            }
        })
        

        // create the user
        const newUser = await tx.user.create({
            data:{
                email:emailNormalized,
                password:hashedPassword,
                role:'SUPERVISOR', // default role for the first user in the organization
                name,
                organizationId:newOrganization.id,
            },
            select:{
                id:true,
                email:true,
                role:true,
                name:true,
                organizationId:true,
            }
        })

        return {user:newUser,organization:newOrganization};
    })

    // generate a token for the user
    const token = await authCrypto.generateToken({
            userId:result.user.id,
            email:result.user.email,
            role:result.user.role,
            organizationId:result.user.organizationId
        })

    return res.status(201).json(new ApiResponse(201,"User created successfully",{token, user:result.user,}))
})

export const handleLogin = asyncHandler(async(req:Request,res:Response)=>{
    const {email,password} = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
        where:{ 
            email:email.trim().toLowerCase()
        }
    })

    if(!user){
        throw new ApiError(401,"Invalid credentials","INVALID_CREDENTIALS");
    }

    const isPasswordValid = await authCrypto.comparePassword(password,user.password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid credentials","INVALID_CREDENTIALS");
    }

    const token = await authCrypto.generateToken({
        userId:user.id,
        email:user.email,
        role:user.role,
        organizationId:user.organizationId
    })

    return res.status(200).json(new ApiResponse(200,"Login successful",{token, user:{
        id:user.id,
        email:user.email,
        role:user.role,
        name:user.name,
        organizationId:user.organizationId
    }}))
})
