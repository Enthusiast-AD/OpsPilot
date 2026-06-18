import type {Request, Response, NextFunction} from 'express';
import {ZodError} from 'zod';
import {ApiError} from '../utils/ApiError.js';
import {normalizeError} from '../utils/normalizeError.js';

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {

    err = normalizeError(err); // Normalize the error to ensure consistent handling

    console.error("Api Error", err);

    // Handle custom ApiError instances
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            data: null,
            error: {
                message: err.message,
                code: err.code || "API_ERROR",
            }
        });
    }

    // Handle Zod validation errors
    if (err instanceof ZodError){
        return res.status(400).json({
            data: null,
            error: {
                message: "Validation Failed",
                code: "VALIDATION_ERROR",
                details: err.issues,
            }
        });
    }

    // Handle other types of errors
    return res.status(500).json({
        data: null,
        error: {
            message: err.message || "Internal Server Error",
            code: err.code || "INTERNAL_SERVER_ERROR",
        }
    })
}