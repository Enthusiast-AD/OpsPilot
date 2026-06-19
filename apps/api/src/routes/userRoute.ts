import {Router} from "express";
import {handleGetWorkers, handleCreateWorker} from "../controllers/userController.js";
import {requireAuth, requireRole} from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth); // Require authentication for all routes in this router

// Only supervisors can access the following routes
router.get("/workers", requireRole("SUPERVISOR"), handleGetWorkers); 
router.post("/workers", requireRole("SUPERVISOR"), handleCreateWorker);

export default router;