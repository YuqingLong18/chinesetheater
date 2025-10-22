import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.js';
import { workshopService } from '../services/workshop.service.js';
import { workshopEvents } from '../services/workshopEvents.service.js';
import { prisma } from '../lib/prisma.js';
import { evaluateRelayContribution, generateAdaptationSuggestions } from '../services/workshopAi.service.js';

const buildNickname = async (req: AuthRequest) => {
  if (!req.user) {
    return '匿名成员';
  }
  if (req.user.role === 'student') {
    const student = await prisma.student.findUnique({ where: { studentId: req.user.id } });
    return student?.username ?? `学员${req.user.id}`;
  }
  const teacher = await prisma.teacher.findUnique({ where: { teacherId: req.user.id } });
  return teacher?.username ?? `教师${req.user.id}`;
};

export const createWorkshopRoom = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const {
    title,
    mode,
    theme,
    originalTitle,
    originalContent,
    meterRequirement,
    maxParticipants,
    targetLines,
    timeLimitMinutes
  } = req.body ?? {};

  if (!title || !mode || !maxParticipants) {
    return res.status(400).json({ message: '缺少必要参数' });
  }

  try {
    const room = await workshopService.createRoom({
      creatorType: req.user.role,
      creatorId: req.user.id,
      title,
      mode,
      theme,
      originalTitle,
      originalContent,
      meterRequirement,
      maxParticipants: Number(maxParticipants),
      targetLines: targetLines ? Number(targetLines) : null,
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null
    });

    return res.status(201).json({ room });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: (error as Error).message });
  }
};

export const listWorkshopRooms = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    const rooms = req.user.role === 'student'
      ? await workshopService.listRoomsForStudent(req.user.id)
      : await workshopService.listRoomsForTeacher(req.user.id);

    return res.json({ rooms });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '加载房间列表失败' });
  }
};

export const joinWorkshopRoom = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const { code, nickname } = req.body ?? {};
  if (!code) {
    return res.status(400).json({ message: '房间码不能为空' });
  }

  try {
    const member = await workshopService.joinRoomByCode({
      code,
      role: req.user.role,
      userId: req.user.id,
      nickname: nickname?.trim() || (await buildNickname(req))
    });

    return res.status(201).json({ member });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: (error as Error).message });
  }
};

export const getWorkshopRoom = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ message: '房间ID无效' });
  }

  try {
    await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const room = await workshopService.getRoomDetail(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }
    return res.json({ room });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: (error as Error).message });
  }
};

export const streamWorkshopRoom = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).end();
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).end();
    return;
  }

  try {
    await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    workshopEvents.subscribe(roomId, res);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
};

export const submitWorkshopContribution = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ message: '房间ID无效' });
  }

  const { content } = req.body ?? {};
  if (!content) {
    return res.status(400).json({ message: '诗句不能为空' });
  }

  try {
    const member = await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const contribution = await workshopService.submitContribution({
      roomId,
      memberId: member.memberId,
      content
    });

    res.status(201).json({ contribution });

    evaluateRelayContribution(roomId, contribution.contributionId).catch((error) => {
      console.error('[workshop.ai] 评价失败', error);
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const postWorkshopChat = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ message: '房间ID无效' });
  }

  const { content } = req.body ?? {};
  if (!content) {
    return res.status(400).json({ message: '消息不能为空' });
  }

  try {
    const member = await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const chat = await workshopService.postChat(roomId, member.memberId, content);
    res.status(201).json({ chat });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const voteContributionRewrite = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ message: '房间ID无效' });
  }

  const { contributionId, voteType } = req.body ?? {};
  if (!contributionId || !voteType) {
    return res.status(400).json({ message: '缺少必要参数' });
  }

  try {
    const member = await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const vote = await workshopService.castVote(roomId, {
      contributionId: Number(contributionId),
      memberId: member.memberId,
      voteType
    });
    res.status(201).json({ vote });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const updateWorkshopBoard = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  const boardId = Number(req.params.boardId);
  if (Number.isNaN(roomId) || Number.isNaN(boardId)) {
    return res.status(400).json({ message: '参数错误' });
  }

  const { content, summary } = req.body ?? {};
  if (!content) {
    return res.status(400).json({ message: '内容不能为空' });
  }

  try {
    const member = await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const board = await workshopService.updateBoard({
      roomId,
      boardId,
      memberId: member.memberId,
      content,
      summary: summary ?? null
    });
    res.status(201).json({ board });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const listWorkshopBoardVersions = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  const boardId = Number(req.params.boardId);
  if (Number.isNaN(roomId) || Number.isNaN(boardId)) {
    return res.status(400).json({ message: '参数错误' });
  }

  try {
    await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const versions = await workshopService.listBoardVersions(boardId);
    res.json({ versions });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const requestWorkshopSuggestion = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ message: '房间ID无效' });
  }

  const { boardId } = req.body ?? {};

  try {
    await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const room = await workshopService.getRoomDetail(roomId);
    if (!room || room.mode !== 'adaptation') {
      return res.status(400).json({ message: '当前房间不支持改编建议' });
    }
    const suggestions = await generateAdaptationSuggestions(roomId, boardId ? Number(boardId) : undefined);
    const stored = await Promise.all(
      suggestions.map((item) =>
        workshopService.addSuggestion({
          roomId,
          boardId: boardId ? Number(boardId) : null,
          suggestionType: item.type,
          content: item.content
        })
      )
    );
    res.status(201).json({ suggestions: stored });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};

export const toggleWorkshopReaction = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: '未授权' });
  }

  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ message: '参数错误' });
  }

  const { targetType, targetId, reactionType } = req.body ?? {};
  if (!targetType || !targetId || !reactionType) {
    return res.status(400).json({ message: '缺少必要参数' });
  }

  try {
    const member = await workshopService.assertMembership(roomId, req.user.role, req.user.id);
    const reaction = await workshopService.toggleReaction({
      roomId,
      memberId: member.memberId,
      targetType,
      targetId: Number(targetId),
      reactionType
    });
    res.status(201).json({ reaction });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message });
  }
};
