import {Router} from "express";
import { handleCreateTask, handleGetTasks , handleUpdateChecklistItem} from "../controllers/taskController.js";
import {requireAuth, requireRole} from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth); // All routes require authentication

// Both workers and supervisors can fetch tasks, but workers will only see their own tasks
router.get("/", handleGetTasks);
router.patch("/checklist/:itemId",handleUpdateChecklistItem); 

// Only supervisors can create tasks
router.post("/", requireRole("SUPERVISOR"), handleCreateTask);

export default router;