import { Router } from 'express';
import {
  createTeacherSession,
  generateStudentAccountsController,
  listTeacherSessions,
  listSessionStudents,
  sessionAnalytics
} from '../controllers/teacher.controller.js';
import { authenticate } from '../middlewares/auth.js';

export const teacherRouter = Router();

teacherRouter.use(authenticate(['teacher']));

teacherRouter.get('/sessions', listTeacherSessions);
teacherRouter.post('/sessions', createTeacherSession);
teacherRouter.post('/sessions/:sessionId/students', generateStudentAccountsController);
teacherRouter.get('/sessions/:sessionId/students', listSessionStudents);
teacherRouter.get('/sessions/:sessionId/analytics', sessionAnalytics);
