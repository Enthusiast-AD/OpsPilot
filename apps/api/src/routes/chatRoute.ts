import {Router} from 'express';
import {handleSaveChatInteraction, handleGetMyChatHistory} from '../controllers/chatController.js';
import {requireAuth} from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/history', handleGetMyChatHistory);
router.post('/record', handleSaveChatInteraction);

export default router;