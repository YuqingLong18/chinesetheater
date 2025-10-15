import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { teacherRouter } from './teacher.routes.js';
import { studentRouter } from './student.routes.js';

export const router = Router();

router.use('/', authRouter);
router.use('/teacher', teacherRouter);
router.use('/student', studentRouter);
