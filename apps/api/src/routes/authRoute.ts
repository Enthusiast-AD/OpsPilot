import {Router} from 'express';
import {handleSignUp,handleLogin} from '../controllers/authController.js';

const router = Router();

router.post('/signup',handleSignUp);
router.post('/login',handleLogin);

export default router;