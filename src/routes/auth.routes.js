// src/routes/auth.routes.js

import { Router } from "express";
import { login } from "../controladores/authCtrl.js";

const router = Router();

router.post("/login", login);

export default router;
