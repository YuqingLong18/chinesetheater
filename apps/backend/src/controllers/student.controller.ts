import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.js';
import { chatMessageSchema, imageGenerationSchema, imageEditSchema } from '../schemas/auth.schema.js';
import { sendStudentMessage } from '../services/chat.service.js';
import { generateImage, listGalleryImages, shareImage, editGeneratedImage } from '../services/image.service.js';
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
    const image = await editGeneratedImage(req.user.id, imageId, parseResult.data.instruction);
    res.json({ image });
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
    const gallery = await listGalleryImages(req.user.sessionId);
    res.json({ gallery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '加载画廊失败' });
  }
};
