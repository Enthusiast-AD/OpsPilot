import {Router} from 'express';
import {
    handleRequestDocLease,
    handleConfirmDocIngest,
    handleListDocuments,
    handleDeleteDocument
} from '../controllers/documentController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth); // Apply authentication middleware to all routes in this router
router.use(requireRole('SUPERVISOR')); // Apply role-based access control to all routes in this router

router.get('/',handleListDocuments);
router.post('/upload/presign', handleRequestDocLease);
router.post('/upload/complete', handleConfirmDocIngest);
router.delete('/:id', handleDeleteDocument);

export default router;