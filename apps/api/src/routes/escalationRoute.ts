import {Router} from 'express';
import {handleGetEscalations, handleUpdateEscalation} from '../controllers/escalationController.js';
import {requireAuth, requireRole} from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('SUPERVISOR'));

router.get('/', handleGetEscalations);
router.patch('/:id', handleUpdateEscalation);

export default router;