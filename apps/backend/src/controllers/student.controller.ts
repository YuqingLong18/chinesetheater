import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.js';
import { Prisma } from '@prisma/client';
import {
  chatMessageSchema,
  imageGenerationSchema,
  imageEditSchema,
  imageRevertSchema,
  spacetimeAnalysisSchema,
  taskSubmissionSchema
} from '../schemas/auth.schema.js';
import { sendStudentMessage } from '../services/chat.service.js';
import {
  generateImage,
  listGalleryImages,
  shareImage,
  editGeneratedImage,
  revertImageEdit,
  toggleImageLike,
  addImageComment,
  listImageComments
} from '../services/image.service.js';
import { createSpacetimeAnalysis, listStudentSpacetimeAnalyses } from '../services/spacetime.service.js';
import { ensureSessionLifeJourney } from '../services/journey.service.js';
import { listTasksForStudent, submitTaskForStudent } from '../services/task.service.js';
import { prisma } from '../lib/prisma.js';

export const getCurrentSession = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const session = await prisma.session.findUnique({ where: { sessionId: req.user.sessionId } });
  if (!session) {
    return res.status(404).json({ message: '会话不存在' });
  }

  res.json({
    session: {
      sessionName: session.sessionName,
      authorName: session.authorName,
      literatureTitle: session.literatureTitle
    }
  });
};

export const studentChat = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const parseResult = chatMessageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '请输入消息' });
  }

  try {
    const result = await sendStudentMessage(req.user.id, req.user.sessionId, parseResult.data.message);
    res.json({ messages: result.messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '发送消息失败' });
  }
};

export const studentChatHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      studentId_sessionId: {
        studentId: req.user.id,
        sessionId: req.user.sessionId
      }
    },
    include: {
      messages: {
        orderBy: { timestamp: 'asc' }
      }
    }
  });

  res.json({ messages: conversation?.messages ?? [] });
};

export const studentGenerateImage = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const parseResult = imageGenerationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '参数错误' });
  }

  try {
    const image = await generateImage(
      req.user.id,
      req.user.sessionId,
      parseResult.data.style,
      parseResult.data.sceneDescription
    );

    res.status(201).json({ image });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const editGeneratedImageController = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(401).json({ message: '未授权' });
  }

  const imageId = Number(req.params.imageId);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ message: '图片ID无效' });
  }

  const parseResult = imageEditSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '请输入编辑描述' });
  }

  try {
    const result = await editGeneratedImage(req.user.id, imageId, parseResult.data.instruction);
    res.json({ image: result.updatedImage, previousImage: result.previousImage });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const shareGeneratedImage = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(401).json({ message: '未授权' });
  }

  const imageId = Number(req.params.imageId);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ message: '图片ID无效' });
  }

  try {
    const image = await shareImage(req.user.id, imageId);
    res.json({ image });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const studentGallery = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const gallery = await listGalleryImages(req.user.sessionId, req.user.id);
    res.json({ gallery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '加载画廊失败' });
  }
};

export const listStudentTasks = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const tasks = await listTasksForStudent(req.user.sessionId, req.user.id);
    res.json({ tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '加载任务清单失败' });
  }
};

export const toggleGalleryLike = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const imageId = Number(req.params.imageId);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ message: '图片ID无效' });
  }

  try {
    const result = await toggleImageLike(req.user.sessionId, req.user.id, imageId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const submitStudentTask = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const taskId = Number(req.params.taskId);
  if (Number.isNaN(taskId)) {
    return res.status(400).json({ message: '任务ID无效' });
  }

  const parseResult = taskSubmissionSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ message: '提交内容无效' });
  }

  try {
    const submission = await submitTaskForStudent(
      taskId,
      req.user.id,
      req.user.sessionId,
      parseResult.data.payload as Prisma.InputJsonValue
    );
    res.status(201).json({ submission });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const createGalleryComment = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const imageId = Number(req.params.imageId);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ message: '图片ID无效' });
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : '';

  try {
    const result = await addImageComment(req.user.sessionId, req.user.id, imageId, content);
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const listGalleryComments = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const imageId = Number(req.params.imageId);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ message: '图片ID无效' });
  }

  try {
    const comments = await listImageComments(req.user.sessionId, imageId);
    res.json({ comments });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const revertEditedImageController = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(401).json({ message: '未授权' });
  }

  const imageId = Number(req.params.imageId);
  if (Number.isNaN(imageId)) {
    return res.status(400).json({ message: '图片ID无效' });
  }

  const parseResult = imageRevertSchema.safeParse({
    previousImageUrl: req.body?.previousImageUrl,
    previousSceneDescription: req.body?.previousSceneDescription,
    previousStyle: req.body?.previousStyle,
    previousEditCount: Number(req.body?.previousEditCount),
    currentImageUrl: req.body?.currentImageUrl
  });

  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '参数错误' });
  }

  try {
    const reverted = await revertImageEdit(req.user.id, imageId, {
      imageUrl: parseResult.data.previousImageUrl,
      sceneDescription: parseResult.data.previousSceneDescription,
      style: parseResult.data.previousStyle,
      editCount: parseResult.data.previousEditCount
    }, parseResult.data.currentImageUrl);

    res.json({ image: reverted });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const createStudentSpacetime = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  const payload = {
    author: String(req.body?.author ?? '').trim(),
    workTitle: String(req.body?.workTitle ?? '').trim(),
    era: String(req.body?.era ?? '').trim(),
    genre: String(req.body?.genre ?? '').trim(),
    analysisType: req.body?.analysisType,
    focusScope: typeof req.body?.focusScope === 'string' && req.body.focusScope.trim().length > 0
      ? req.body.focusScope.trim()
      : undefined,
    promptNotes: typeof req.body?.promptNotes === 'string' && req.body.promptNotes.trim().length > 0
      ? req.body.promptNotes.trim()
      : undefined,
    customInstruction:
      typeof req.body?.customInstruction === 'string' && req.body.customInstruction.trim().length > 0
        ? req.body.customInstruction.trim()
        : undefined
  };

  const parseResult = spacetimeAnalysisSchema.safeParse(payload);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '请输入完整信息' });
  }

  try {
    const analysis = await createSpacetimeAnalysis(req.user.id, req.user.sessionId, parseResult.data);
    res.status(201).json({ analysis });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const listStudentSpacetime = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const analyses = await listStudentSpacetimeAnalyses(req.user.id, req.user.sessionId);
    res.json({ analyses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '加载对比分析记录失败' });
  }
};

export const getLifeJourney = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student' || !req.user.sessionId) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const journey = await ensureSessionLifeJourney(req.user.sessionId);
    res.json({ journey });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};
