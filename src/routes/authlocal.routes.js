// src/routes/auth.routes.js

import { Router } from "express";
import { login } from "../controladores/authlocalCtrl.js";

const router = Router();

router.post("/loginlocal", login);

export default router;
