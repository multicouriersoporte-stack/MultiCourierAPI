// src/routes/chatbot.routes.js

import { Router } from "express";
import { chat } from '../controladores/chatbotCtrl.js';

const router = Router();

router.post('/chatbot', chat);

export default router;