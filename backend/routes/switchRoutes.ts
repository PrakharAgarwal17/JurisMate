import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as switchController from "../controller/switchController.js";
import isLoggedIn from "../middleware/isLoggedIn.js";

const router = Router();
const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(isLoggedIn);
router.get("/rooms", switchController.listRooms);
router.post("/rooms", switchController.connectRoom);
router.delete("/rooms/:roomId", switchController.disconnectRoom);
router.post("/rooms/:roomId/messages", messageLimiter, switchController.sendRoomMessage);

export default router;
