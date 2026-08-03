import express from "express";
import { startConversation, sendMessage, getMessages , getConversations, markSeen , getUnreadCount } from "../controllers/chatController.js";

const router = express.Router();
router.post("/start", startConversation);

// Send message
router.post("/send", sendMessage);

// Get messages
router.get("/messages/:conversationId", getMessages);

// Admin conversation list
router.get("/conversations", getConversations);

// Seen
router.put("/seen/:conversationId", markSeen);
router.get(
  "/unread/:studentId",
  getUnreadCount
);

export default router;