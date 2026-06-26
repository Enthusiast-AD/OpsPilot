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
import { 
    handleGenerateUploadRequest,
    handleConfirmUpload,
    handleGetTaskAttachments,
    handleDeleteAttachment,
 } from "../controllers/attachmentController.js";

const router = Router();

router.use(requireAuth); // All routes require authentication

// Both workers and supervisors can fetch tasks, but workers will only see their own tasks 
router.get("/", handleGetTasks);
router.get("/:taskId", handleGetTaskById);

// Operations accessible to field workers or supervising staff safely bound by ownership checks
router.patch("/checklist/:id",handleUpdateChecklistItem); 
router.post("/:taskId/escalate", handleEscalateTask); 

// Attachment management routes
router.post("/:taskId/attachments/presign", handleGenerateUploadRequest); // Generate a presigned URL for attachment upload
router.post("/:taskId/attachments/confirm", handleConfirmUpload); // Confirm attachment upload
router.get("/:taskId/attachments", handleGetTaskAttachments); // Get all attachments for a task

// Only supervisors can create, update, or delete tasks
router.post("/", requireRole("SUPERVISOR"), handleCreateTask);
router.patch("/:taskId", requireRole("SUPERVISOR"), handleUpdateTask);
router.delete("/:taskId", requireRole("SUPERVISOR"), handleDeleteTask);

// Attachment deletion is restricted to supervisors to ensure proper oversight and prevent unauthorized removal of files
router.delete("/attachments/:id", requireRole("SUPERVISOR"), handleDeleteAttachment); // Delete an attachment


export default router;