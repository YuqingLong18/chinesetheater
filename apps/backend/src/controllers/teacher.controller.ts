import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.js';
import { createSession, getTeacherSessions, getSessionWithStudents, getSessionById } from '../services/session.service.js';
import { createStudentAccounts, listStudentsForSession } from '../services/student.service.js';
import { getSessionAnalytics, getSessionActivityFeed } from '../services/analytics.service.js';
import { createSessionSchema, studentBatchSchema } from '../schemas/auth.schema.js';
import { getSessionTaskSummary } from '../services/task.service.js';
import { getStoredLifeJourney, refreshSessionLifeJourney } from '../services/journey.service.js';

const activeJourneyGenerations = new Set<number>();
const journeyGenerationErrors = new Map<number, string>();

const isJourneyGenerating = (sessionId: number) => activeJourneyGenerations.has(sessionId);

export const createTeacherSession = async (req: AuthRequest, res: Response) => {
  const parseResult = createSessionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '参数错误' });
  }

  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const tasks = (parseResult.data.tasks ?? []).map((task, index) => ({
      ...task,
      orderIndex: task.orderIndex ?? index
    }));

    // Use central user ID from authenticated user
    const session = await createSession(
      req.user.id, // This is now the central user ID
      parseResult.data.sessionName,
      parseResult.data.sessionPin,
      parseResult.data.authorName,
      parseResult.data.literatureTitle,
      tasks
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
    if (!session || session.centralUserId !== req.user.id) {
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
    if (!session || session.centralUserId !== req.user.id) {
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
    if (!session || session.centralUserId !== req.user.id) {
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
    if (!session || session.centralUserId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const analytics = await getSessionAnalytics(sessionId);
    res.json({ analytics });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取课堂数据失败' });
  }
};

export const sessionTasksSummary = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  try {
    const session = await getSessionWithStudents(sessionId);
    if (!session || session.centralUserId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const summary = await getSessionTaskSummary(sessionId);
    res.json({ summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取任务清单失败' });
  }
};

export const getTeacherSessionLifeJourney = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  try {
    const session = await getSessionById(sessionId);
    if (!session || session.centralUserId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    const stored = await getStoredLifeJourney(sessionId);
    const generating = isJourneyGenerating(sessionId);
    const errorMessage = journeyGenerationErrors.get(sessionId) ?? null;

    if (!stored) {
      return res.json({
        journey: null,
        generatedAt: null,
        generating,
        errorMessage
      });
    }

    res.json({
      journey: stored.journey,
      generatedAt: stored.generatedAt ? stored.generatedAt.toISOString() : null,
      generating,
      errorMessage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '加载人生行迹失败' });
  }
};

export const generateTeacherSessionLifeJourney = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const sessionId = Number(req.params.sessionId);
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ message: '会话ID无效' });
  }

  // Validate entries if provided
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (entries.length > 0) {
    for (const entry of entries) {
      if (entry.startYear && (typeof entry.startYear !== 'number' || entry.startYear < 0 || entry.startYear > 9999)) {
        return res.status(400).json({ message: '起始年份无效' });
      }
      if (entry.endYear && (typeof entry.endYear !== 'number' || entry.endYear < 0 || entry.endYear > 9999)) {
        return res.status(400).json({ message: '终止年份无效' });
      }
      if (entry.startYear && entry.endYear && entry.startYear > entry.endYear) {
        return res.status(400).json({ message: '起始年份不能大于终止年份' });
      }
      if (entry.ancientName && typeof entry.ancientName !== 'string') {
        return res.status(400).json({ message: '古代地名格式无效' });
      }
      if (entry.modernName && typeof entry.modernName !== 'string') {
        return res.status(400).json({ message: '现代地名格式无效' });
      }
      if (entry.events && typeof entry.events !== 'string') {
        return res.status(400).json({ message: '关键事件格式无效' });
      }
      if (entry.geography && typeof entry.geography !== 'string') {
        return res.status(400).json({ message: '地理风物格式无效' });
      }
      if (entry.poems && typeof entry.poems !== 'string') {
        return res.status(400).json({ message: '代表诗作格式无效' });
      }
    }
  }

  if (isJourneyGenerating(sessionId)) {
    return res.status(409).json({ message: '人生行迹正在生成，请稍候重试' });
  }

  try {
    const session = await getSessionById(sessionId);
    if (!session || session.centralUserId !== req.user.id) {
      return res.status(404).json({ message: '未找到会话或无权操作' });
    }

    journeyGenerationErrors.delete(sessionId);
    activeJourneyGenerations.add(sessionId);

    void (async () => {
      try {
        await refreshSessionLifeJourney(sessionId, {
          entries: entries.length > 0 ? entries : undefined
        });
        journeyGenerationErrors.delete(sessionId);
      } catch (error) {
        console.error(`生成人生行迹失败: sessionId=${sessionId}`, error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : '生成人生行迹失败，请稍后再试';
        journeyGenerationErrors.set(sessionId, message);
      } finally {
        activeJourneyGenerations.delete(sessionId);
      }
    })();

    res.status(202).json({ status: 'processing' });
  } catch (error) {
    console.error(error);
    activeJourneyGenerations.delete(sessionId);
    journeyGenerationErrors.set(
      sessionId,
      error instanceof Error && error.message ? error.message : '生成人生行迹失败，请稍后再试'
    );
    res.status(500).json({ message: '生成人生行迹失败' });
  }
};
