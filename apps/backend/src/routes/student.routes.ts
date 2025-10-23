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
  listStudentTasks,
  submitStudentTask,
  revertEditedImageController,
  createStudentSpacetime,
  listStudentSpacetime,
  getLifeJourney,
  toggleGalleryLike,
  createGalleryComment,
  listGalleryComments
} from '../controllers/student.controller.js';
import {
  createWorkshopRoom,
  listWorkshopRooms,
  joinWorkshopRoom,
  getWorkshopRoom,
  streamWorkshopRoom,
  submitWorkshopContribution,
  postWorkshopChat,
  voteContributionRewrite,
  updateWorkshopBoard,
  listWorkshopBoardVersions,
  requestWorkshopSuggestion,
  toggleWorkshopReaction
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
studentRouter.get('/tasks', listStudentTasks);
studentRouter.post('/tasks/:taskId/submission', submitStudentTask);
studentRouter.post('/gallery/:imageId/like', toggleGalleryLike);
studentRouter.post('/gallery/:imageId/comments', createGalleryComment);
studentRouter.get('/gallery/:imageId/comments', listGalleryComments);
studentRouter.post('/spacetime', createStudentSpacetime);
studentRouter.get('/spacetime', listStudentSpacetime);
studentRouter.get('/life-journey', getLifeJourney);
studentRouter.post('/workshops', createWorkshopRoom);
studentRouter.get('/workshops', listWorkshopRooms);
studentRouter.post('/workshops/join', joinWorkshopRoom);
studentRouter.get('/workshops/:roomId', getWorkshopRoom);
studentRouter.get('/workshops/:roomId/stream', streamWorkshopRoom);
studentRouter.post('/workshops/:roomId/contributions', submitWorkshopContribution);
studentRouter.post('/workshops/:roomId/chat', postWorkshopChat);
studentRouter.post('/workshops/:roomId/votes', voteContributionRewrite);
studentRouter.post('/workshops/:roomId/boards/:boardId', updateWorkshopBoard);
studentRouter.get('/workshops/:roomId/boards/:boardId/versions', listWorkshopBoardVersions);
studentRouter.post('/workshops/:roomId/suggestions', requestWorkshopSuggestion);
studentRouter.post('/workshops/:roomId/reactions', toggleWorkshopReaction);
