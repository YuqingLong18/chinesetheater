import { Router } from 'express';
import { teacherLogin, studentLogin } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/teacher/login', teacherLogin);
authRouter.post('/student/login', studentLogin);
