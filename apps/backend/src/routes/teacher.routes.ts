import { Router } from 'express';
import {
  createTeacherSession,
  generateStudentAccountsController,
  listTeacherSessions,
  listSessionStudents,
  sessionAnalytics,
  sessionActivityFeed,
  sessionTasksSummary,
  getTeacherSessionLifeJourney,
  generateTeacherSessionLifeJourney
} from '../controllers/teacher.controller.js';
import { authenticate } from '../middlewares/auth.js';

export const teacherRouter = Router();

teacherRouter.use(authenticate(['teacher']));

teacherRouter.get('/sessions', listTeacherSessions);
teacherRouter.post('/sessions', createTeacherSession);
teacherRouter.post('/sessions/:sessionId/students', generateStudentAccountsController);
teacherRouter.get('/sessions/:sessionId/students', listSessionStudents);
teacherRouter.get('/sessions/:sessionId/analytics', sessionAnalytics);
teacherRouter.get('/sessions/:sessionId/activity', sessionActivityFeed);
teacherRouter.get('/sessions/:sessionId/tasks', sessionTasksSummary);
teacherRouter.get('/sessions/:sessionId/life-journey', getTeacherSessionLifeJourney);
teacherRouter.post('/sessions/:sessionId/life-journey', generateTeacherSessionLifeJourney);
