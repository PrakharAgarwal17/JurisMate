import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as switchController from "../controller/switchController.js";
import isLoggedIn from "../middleware/isLoggedIn.js";
import { courtroomHistory, courtroomTurn } from "../controller/courtroomController.js";

const router = Router();
const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const verificationLimiter = rateLimit({ windowMs: 5 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });

router.use(isLoggedIn);
router.get("/rooms", switchController.listRooms);
router.post("/rooms", switchController.connectRoom);
router.post("/invitations/join", switchController.joinRoom);
router.post("/rooms/:roomId/invite", switchController.createInvite);
router.delete("/rooms/:roomId/collaboration", switchController.endCollaboration);
router.delete("/rooms/:roomId", switchController.disconnectRoom);
router.post("/rooms/:roomId/verification", verificationLimiter, switchController.startVerification);
router.post("/rooms/:roomId/verification/confirm", verificationLimiter, switchController.verifyRoom);
router.get("/rooms/:roomId/messages", switchController.roomHistory);
router.post("/rooms/:roomId/messages", messageLimiter, switchController.sendRoomMessage);
router.get("/rooms/:roomId/courtroom", courtroomHistory);
router.post("/rooms/:roomId/courtroom", messageLimiter, courtroomTurn);

export default router;
