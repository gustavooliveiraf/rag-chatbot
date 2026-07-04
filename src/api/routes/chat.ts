import { Router } from "express";
import { postChat } from "../controllers/chatController.js";

export const chatRouter = Router();

chatRouter.post("/chat", postChat);
