import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.js';
import { createSession, getTeacherSessions, getSessionWithStudents } from '../services/session.service.js';
import { createStudentAccounts, listStudentsForSession } from '../services/student.service.js';
import { getSessionAnalytics, getSessionActivityFeed } from '../services/analytics.service.js';
import { createSessionSchema, studentBatchSchema } from '../schemas/auth.schema.js';

export const createTeacherSession = async (req: AuthRequest, res: Response) => {
  const parseResult = createSessionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '参数错误' });
  }

  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const session = await createSession(
      req.user.id,
      parseResult.data.sessionName,
      parseResult.data.sessionPin,
      parseResult.data.authorName,
      parseResult.data.literatureTitle
    );

    res.status(201).json({ session });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const listTeacherSessions = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const sessions = await getTeacherSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取会话列表失败' });
  }
};

export const generateStudentAccountsController = async (req: AuthRequest, res: Response) => {
  const parseResult = studentBatchSchema.safeParse({
    quantity: Number(req.body?.quantity)
  });

  if (!parseResult.success) {
    return res.status(400).json({ message: '数量需在1至50之间' });
  }

  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  try {
    const session = await getSessionWithStudents(sessionId);
    if (!session || session.teacherId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const credentials = await createStudentAccounts(sessionId, parseResult.data.quantity);
    res.status(201).json({ credentials });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '生成学生账号失败' });
  }
};

export const listSessionStudents = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  try {
    const session = await getSessionWithStudents(sessionId);
    if (!session || session.teacherId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const students = await listStudentsForSession(sessionId);
    res.json({ students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取学生列表失败' });
  }
};


export const sessionActivityFeed = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  try {
    const session = await getSessionWithStudents(sessionId);
    if (!session || session.teacherId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const activity = await getSessionActivityFeed(sessionId);
    res.json({ activity });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取课堂详情失败' });
  }
};

export const sessionAnalytics = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  try {
    const session = await getSessionWithStudents(sessionId);
    if (!session || session.teacherId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const analytics = await getSessionAnalytics(sessionId);
    res.json({ analytics });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取课堂数据失败' });
  }
};
