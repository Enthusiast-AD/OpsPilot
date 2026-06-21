import {Router} from "express";
import { 
    handleCreateTask, 
    handleGetTasks , 
    handleUpdateChecklistItem, 
    handleGetTaskById, 
    handleUpdateTask, 
    handleDeleteTask, 
    handleEscalateTask
} from "../controllers/taskController.js";
import {requireAuth, requireRole} from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth); // All routes require authentication

// Both workers and supervisors can fetch tasks, but workers will only see their own tasks 
router.get("/", handleGetTasks);
router.get("/:id", handleGetTaskById);

// Operations accessible to field workers or supervising staff safely bound by ownership checks
router.patch("/checklist/:id",handleUpdateChecklistItem); 
router.post("/:id/escalate", handleEscalateTask); 

// Only supervisors can create, update, or delete tasks
router.post("/", requireRole("SUPERVISOR"), handleCreateTask);
router.patch("/:id", requireRole("SUPERVISOR"), handleUpdateTask);
router.delete("/:id", requireRole("SUPERVISOR"), handleDeleteTask);
export default router;