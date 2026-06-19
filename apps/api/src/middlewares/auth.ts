import type {Request, Response, NextFunction} from 'express';
import {authCrypto} from '@opspilot/auth';
import {ApiError} from '../utils/ApiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';

// Middleware to require authentication
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new ApiError(401, 'Unauthorized: Missing or invalid Authorization header', 'UNAUTHORIZED'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = authCrypto.verifyToken(token!);

    if (!decoded) {
        return next(new ApiError(401, 'Unauthorized: Invalid token', 'UNAUTHORIZED'));
    }

    // Attach user info to the request object for downstream handlers
    req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
    }
    next();
});

// Middleware to check if the user has the required role
export const requireRole = (role: "SUPERVISOR" | "WORKER") => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new ApiError(401, 'Unauthorized: User not authenticated', 'UNAUTHORIZED'));
        }
        if (req.user.role !== role) {
            return next(new ApiError(403, 'Forbidden: Insufficient permissions', 'FORBIDDEN'));
        }
        next();
    };
};