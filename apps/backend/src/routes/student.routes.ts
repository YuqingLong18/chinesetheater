import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getCurrentSession,
  studentChat,
  studentChatHistory,
  studentGenerateImage,
  shareGeneratedImage,
  editGeneratedImageController,
  studentGallery,
  revertEditedImageController,
  createStudentSpacetime,
  listStudentSpacetime,
  createLifeJourney
} from '../controllers/student.controller.js';
import {
  createWorkshopRoom,
  listWorkshopRooms,
  joinWorkshopRoom,
  getWorkshopRoom,
  streamWorkshopRoom,
  submitWorkshopContribution,
  postWorkshopChat,
  voteContributionRewrite
} from '../controllers/workshop.controller.js';

export const studentRouter = Router();

studentRouter.use(authenticate(['student']));

studentRouter.get('/session', getCurrentSession);
studentRouter.post('/chat', studentChat);
studentRouter.get('/chat/history', studentChatHistory);
studentRouter.post('/generate-image', studentGenerateImage);
studentRouter.post('/images/:imageId/share', shareGeneratedImage);
studentRouter.post('/images/:imageId/edit', editGeneratedImageController);
studentRouter.post('/images/:imageId/revert', revertEditedImageController);
studentRouter.get('/gallery', studentGallery);
studentRouter.post('/spacetime', createStudentSpacetime);
studentRouter.get('/spacetime', listStudentSpacetime);
studentRouter.post('/life-journey', createLifeJourney);
studentRouter.post('/workshops', createWorkshopRoom);
studentRouter.get('/workshops', listWorkshopRooms);
studentRouter.post('/workshops/join', joinWorkshopRoom);
studentRouter.get('/workshops/:roomId', getWorkshopRoom);
studentRouter.get('/workshops/:roomId/stream', streamWorkshopRoom);
studentRouter.post('/workshops/:roomId/contributions', submitWorkshopContribution);
studentRouter.post('/workshops/:roomId/chat', postWorkshopChat);
studentRouter.post('/workshops/:roomId/votes', voteContributionRewrite);
