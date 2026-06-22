import {Router} from 'express';
import { handleSyncPull, handleSyncPush } from '../controllers/syncController.js';
import { requireAuth } from '../middlewares/auth.js';
const router = Router();

router.use(requireAuth);

router.post('/pull', handleSyncPull);
router.post('/push', handleSyncPush);

export default router;