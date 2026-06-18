import {Prisma} from '@opspilot/database';
import {ApiError} from './ApiError.js';

export function normalizeError(err:unknown){
    if(err instanceof Prisma.PrismaClientKnownRequestError){
        switch(err.code){
            case 'P2002':
                const fields = err.meta?.target;

                return new ApiError(
                    409,
                    `Duplicate value for 
                    ${Array.isArray(fields) ? fields.join(', ') : "resource"}.`,
                    'DUPLICATE_RESOURCE'
                )
            default:
                return new ApiError(
                    400,
                    "An unexpected database error occurred.",
                    'DATABASE_ERROR'
                    )
        }
        
    }
    return err;
}