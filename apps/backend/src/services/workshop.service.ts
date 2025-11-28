import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import type {
  Prisma,
  WorkshopContribution,
  WorkshopContributionStatus,
  WorkshopMember,
  WorkshopMode,
  WorkshopRoom,
  WorkshopStatus,
  WorkshopVoteType,
  WorkshopBoardType,
  WorkshopReactionType,
  WorkshopReactionTargetType,
  WorkshopSuggestionType
} from '@prisma/client';
import { workshopEvents } from './workshopEvents.service.js';

const WORKSHOP_CODE_LENGTH = 6;
const ADAPTATION_BOARDS: Array<{ type: WorkshopBoardType; title: string }> = [
  { type: 'plot', title: '情节框架' },
  { type: 'imagery', title: '核心意象转化' },
  { type: 'dialogue', title: '对白与描写' },
  { type: 'ending', title: '结尾构思' },
  { type: 'notes', title: '创作笔记' },
  { type: 'finalDraft', title: '最终文稿' }
];

const generateRoomCode = async (): Promise<string> => {
  const attempt = () => randomBytes(Math.ceil(WORKSHOP_CODE_LENGTH / 2)).toString('hex').slice(0, WORKSHOP_CODE_LENGTH).toUpperCase();
  let code = attempt();
  let exists = await prisma.workshopRoom.findUnique({ where: { code } });
  let guard = 0;
  while (exists && guard < 5) {
    code = attempt();
    exists = await prisma.workshopRoom.findUnique({ where: { code } });
    guard += 1;
  }
  if (exists) {
    throw new Error('创建房间失败，请稍后再试');
  }
  return code;
};

const sanitizeContent = (content: string) => content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

const sanitizeRichText = (content: string) =>
  content
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 5000);

export interface CreateWorkshopInput {
  creatorType: 'student' | 'teacher';
  creatorId: number;
  title: string;
  mode: WorkshopMode;
  theme?: string | null;
  originalTitle?: string | null;
  originalContent?: string | null;
  meterRequirement?: string | null;
  maxParticipants: number;
  targetLines?: number | null;
  timeLimitMinutes?: number | null;
}

export const workshopService = {
  async createRoom(input: CreateWorkshopInput) {
    if (input.maxParticipants < 2 || input.maxParticipants > 10) {
      throw new Error('参与人数需在2到10人之间');
    }

    const code = await generateRoomCode();

    return prisma.$transaction(async (tx) => {
      const room = await tx.workshopRoom.create({
        data: {
          code,
          title: input.title,
          mode: input.mode,
          theme: input.theme,
          originalTitle: input.originalTitle,
          originalContent: input.originalContent,
          meterRequirement: input.meterRequirement,
          maxParticipants: input.maxParticipants,
          targetLines: input.targetLines,
          timeLimitMinutes: input.timeLimitMinutes,
          currentTurnOrder: 0,
          creatorStudentId: input.creatorType === 'student' ? input.creatorId : null,
          creatorTeacherId: input.creatorType === 'teacher' ? input.creatorId : null,
          members: {
            create: {
              role: input.creatorType,
              studentId: input.creatorType === 'student' ? input.creatorId : null,
              teacherId: input.creatorType === 'teacher' ? input.creatorId : null,
              nickname: input.creatorType === 'student' ? `学员${input.creatorId}` : `教师${input.creatorId}`,
              orderIndex: 0
            }
          }
        }
      });

      if (input.mode === 'adaptation') {
        await Promise.all(
          ADAPTATION_BOARDS.map((board, index) =>
            tx.workshopBoard.create({
              data: {
                roomId: room.roomId,
                boardType: board.type,
                title: board.title,
                content: index === 0 && input.originalContent
                  ? `原作参考：\n${input.originalContent}`
                  : ''
              }
            })
          )
        );
      }

      return tx.workshopRoom.findUnique({
        where: { roomId: room.roomId },
        include: {
          members: true,
          boards: true
        }
      });
    });
  },

  async listRoomsForStudent(studentId: number) {
    return prisma.workshopRoom.findMany({
      where: {
        members: {
          some: {
            studentId,
            role: 'student'
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        members: true
      }
    });
  },

  async listRoomsForTeacher(centralUserId: number) {
    // teacherId field now stores central user ID for teachers
    return prisma.workshopRoom.findMany({
      where: {
        members: {
          some: {
            teacherId: centralUserId,
            role: 'teacher'
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        members: true
      }
    });
  },

  async joinRoomByCode(params: { code: string; role: 'student' | 'teacher'; userId: number; nickname: string }) {
    const room = await prisma.workshopRoom.findUnique({ where: { code: params.code }, include: { members: true } });
    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.members.length >= room.maxParticipants) {
      throw new Error('房间人数已满');
    }

    const existing = room.members.find((member) =>
      params.role === 'student' ? member.studentId === params.userId : member.teacherId === params.userId
    );

    if (existing) {
      return existing;
    }

    const orderIndex = room.members.length;

    const member = await prisma.workshopMember.create({
      data: {
        roomId: room.roomId,
        role: params.role,
        studentId: params.role === 'student' ? params.userId : null,
        teacherId: params.role === 'teacher' ? params.userId : null,
        nickname: params.nickname,
        orderIndex
      }
    });

    workshopEvents.emit(room.roomId, {
      type: 'member.join',
      payload: {
        member
      }
    });

    return member;
  },

  async getRoomDetail(roomId: number) {
    return prisma.workshopRoom.findUnique({
      where: { roomId },
      include: {
        members: {
          orderBy: { orderIndex: 'asc' }
        },
        contributions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            member: true,
            votes: true,
            reactions: true
          }
        },
        chats: {
          orderBy: { createdAt: 'asc' }
        },
        boards: {
          include: {
            versions: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              include: {
                member: true
              }
            },
            reactions: true
          }
        },
        suggestions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        reactions: true
      }
    });
  },

  async assertMembership(roomId: number, role: 'student' | 'teacher', userId: number) {
    const member = await prisma.workshopMember.findFirst({
      where: {
        roomId,
        role,
        studentId: role === 'student' ? userId : undefined,
        teacherId: role === 'teacher' ? userId : undefined,
        isActive: true
      }
    });
    if (!member) {
      throw new Error('未加入该创作房间');
    }
    return member;
  },

  async submitContribution(params: { roomId: number; memberId: number; content: string }) {
    const room = await prisma.workshopRoom.findUnique({
      where: { roomId: params.roomId },
      include: {
        members: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' }
        },
        contributions: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!room) {
      throw new Error('房间不存在');
    }

    const sanitized = sanitizeContent(params.content);
    if (!sanitized) {
      throw new Error('诗句不能为空');
    }

    const memberOrder = room.members.findIndex((member) => member.memberId === params.memberId);
    if (memberOrder === -1) {
      throw new Error('你未加入该房间');
    }

    // Calculate how many times each member has contributed
    const contributionCounts = new Map<number, number>();
    room.contributions.forEach((contribution) => {
      const count = contributionCounts.get(contribution.memberId) ?? 0;
      contributionCounts.set(contribution.memberId, count + 1);
    });

    // Find members who haven't written yet (contribution count = 0)
    const membersWithoutContributions = room.members.filter(
      (member) => (contributionCounts.get(member.memberId) ?? 0) === 0
    );

    // Determine whose turn it is
    let expectedMemberId: number | null = null;
    if (membersWithoutContributions.length > 0) {
      // Priority: members who haven't written yet, in order of joining (orderIndex)
      const nextMember = membersWithoutContributions[0];
      expectedMemberId = nextMember.memberId;
    } else {
      // All members have written at least once, find the minimum contribution count
      const minCount = Math.min(...Array.from(contributionCounts.values()));
      const membersWithMinCount = room.members.filter(
        (member) => (contributionCounts.get(member.memberId) ?? 0) === minCount
      );

      // Among members with minimum count, find the one who should go next
      // Use currentTurnOrder as a hint, but ensure fairness
      const currentOrder = room.currentTurnOrder ?? 0;
      const currentMember = room.members[currentOrder];
      
      if (currentMember && membersWithMinCount.some((m) => m.memberId === currentMember.memberId)) {
        expectedMemberId = currentMember.memberId;
      } else {
        // Find the first member with min count, starting from currentOrder
        let found = false;
        for (let i = 0; i < room.members.length; i++) {
          const idx = (currentOrder + i) % room.members.length;
          const member = room.members[idx];
          if (membersWithMinCount.some((m) => m.memberId === member.memberId)) {
            expectedMemberId = member.memberId;
            found = true;
            break;
          }
        }
        if (!found && membersWithMinCount.length > 0) {
          expectedMemberId = membersWithMinCount[0].memberId;
        }
      }
    }

    if (!expectedMemberId || expectedMemberId !== params.memberId) {
      const expectedMember = room.members.find((m) => m.memberId === expectedMemberId);
      throw new Error(`尚未轮到你提交，当前应该轮到：${expectedMember?.nickname ?? '其他成员'}`);
    }

    // Calculate next turn order
    // After this contribution, check if we need to move to next round
    const myContributionCount = (contributionCounts.get(params.memberId) ?? 0) + 1;
    const minCountAfter = Math.min(
      ...room.members.map((m) => {
        if (m.memberId === params.memberId) return myContributionCount;
        return contributionCounts.get(m.memberId) ?? 0;
      })
    );

    // Find next member: prioritize those with fewer contributions
    const membersWithMinCountAfter = room.members.filter((m) => {
      const count = m.memberId === params.memberId ? myContributionCount : (contributionCounts.get(m.memberId) ?? 0);
      return count === minCountAfter;
    });

    // Find next member in order, starting from current member
    let nextOrder = memberOrder;
    let nextFound = false;
    for (let i = 1; i <= room.members.length; i++) {
      const idx = (memberOrder + i) % room.members.length;
      const member = room.members[idx];
      if (membersWithMinCountAfter.some((m) => m.memberId === member.memberId)) {
        nextOrder = idx;
        nextFound = true;
        break;
      }
    }

    if (!nextFound && membersWithMinCountAfter.length > 0) {
      nextOrder = room.members.findIndex((m) => m.memberId === membersWithMinCountAfter[0].memberId);
    }

    const orderIndex = (room.contributions[room.contributions.length - 1]?.orderIndex ?? -1) + 1;

    const contribution = await prisma.$transaction(async (tx) => {
      const created = await tx.workshopContribution.create({
        data: {
          roomId: params.roomId,
          memberId: params.memberId,
          orderIndex,
          content: sanitized
        },
        include: {
          member: true,
          votes: true,
          reactions: true
        }
      });

      await tx.workshopRoom.update({
        where: { roomId: params.roomId },
        data: { currentTurnOrder: nextOrder }
      });

      return created;
    });

    workshopEvents.emit(params.roomId, {
      type: 'contribution.added',
      payload: {
        contribution,
        nextTurnOrder: nextOrder
      }
    });

    return contribution;
  },

  async recordFeedback(roomId: number, contributionId: number, feedback: Prisma.InputJsonValue) {
    const contribution = await prisma.workshopContribution.update({
      where: { contributionId },
      data: { aiFeedback: feedback },
      include: {
        member: true,
        votes: true,
        reactions: true
      }
    });

    workshopEvents.emit(roomId, {
      type: 'contribution.feedback',
      payload: contribution
    });

    return contribution;
  },

  async updateBoard(params: { roomId: number; boardId: number; memberId: number; content: string; summary?: string | null }) {
    const board = await prisma.workshopBoard.findUnique({
      where: { boardId: params.boardId },
      include: {
        room: true
      }
    });

    if (!board || board.roomId !== params.roomId) {
      throw new Error('创作板块不存在');
    }

    const sanitized = sanitizeRichText(params.content);
    if (!sanitized) {
      throw new Error('内容不能为空');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workshopBoardVersion.create({
        data: {
          boardId: params.boardId,
          memberId: params.memberId,
          summary: params.summary ?? null,
          content: sanitized
        }
      });

      return tx.workshopBoard.update({
        where: { boardId: params.boardId },
        data: { content: sanitized },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { member: true }
          },
          reactions: true
        }
      });
    });

    workshopEvents.emit(params.roomId, {
      type: 'board.updated',
      payload: updated
    });

    return updated;
  },

  async listBoardVersions(boardId: number, take = 10) {
    return prisma.workshopBoardVersion.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        member: true
      }
    });
  },

  async addSuggestion(params: { roomId: number; boardId?: number | null; suggestionType: WorkshopSuggestionType; content: string }) {
    const suggestion = await prisma.workshopAiSuggestion.create({
      data: {
        roomId: params.roomId,
        boardId: params.boardId ?? null,
        suggestionType: params.suggestionType,
        content: params.content
      }
    });

    workshopEvents.emit(params.roomId, {
      type: 'suggestion.added',
      payload: suggestion
    });

    return suggestion;
  },

  async toggleReaction(params: {
    roomId: number;
    memberId: number;
    targetType: WorkshopReactionTargetType;
    targetId: number;
    reactionType: WorkshopReactionType;
  }) {
    if (params.targetType === 'contribution') {
      const contribution = await prisma.workshopContribution.findUnique({ where: { contributionId: params.targetId } });
      if (!contribution || contribution.roomId !== params.roomId) {
        throw new Error('作品不存在');
      }
    } else {
      const board = await prisma.workshopBoard.findUnique({ where: { boardId: params.targetId } });
      if (!board || board.roomId !== params.roomId) {
        throw new Error('创作板块不存在');
      }
    }

    const existing = await prisma.workshopReaction.findUnique({
      where: {
        roomId_memberId_targetType_targetId: {
          roomId: params.roomId,
          memberId: params.memberId,
          targetType: params.targetType,
          targetId: params.targetId
        }
      }
    });

    let reaction;
    if (existing && existing.reactionType === params.reactionType) {
      reaction = await prisma.workshopReaction.delete({ where: { reactionId: existing.reactionId } });
    } else if (existing) {
      reaction = await prisma.workshopReaction.update({
        where: { reactionId: existing.reactionId },
        data: { reactionType: params.reactionType }
      });
    } else {
      reaction = await prisma.workshopReaction.create({
        data: {
          roomId: params.roomId,
          memberId: params.memberId,
          targetType: params.targetType,
          targetId: params.targetId,
          reactionType: params.reactionType,
          contributionId: params.targetType === 'contribution' ? params.targetId : null,
          boardId: params.targetType === 'board' ? params.targetId : null
        }
      });
    }

    workshopEvents.emit(params.roomId, {
      type: 'reaction.update',
      payload: {
        targetType: params.targetType,
        targetId: params.targetId,
        memberId: params.memberId,
        reactionType: existing && existing.reactionType === params.reactionType ? null : params.reactionType
      }
    });

    return reaction;
  },

  async postChat(roomId: number, memberId: number | null, content: string, messageType: 'message' | 'system' = 'message') {
    const sanitized = sanitizeContent(content);
    if (!sanitized) {
      throw new Error('内容不能为空');
    }

    const chat = await prisma.workshopChatMessage.create({
      data: {
        roomId,
        memberId,
        content: sanitized,
        messageType
      },
      include: {
        member: true
      }
    });

    workshopEvents.emit(roomId, {
      type: 'chat.message',
      payload: chat
    });

    return chat;
  },

  async castVote(roomId: number, params: { contributionId: number; memberId: number; voteType: WorkshopVoteType }) {
    const contribution = await prisma.workshopContribution.findUnique({
      where: { contributionId: params.contributionId },
      include: {
        room: {
          include: {
            members: {
              where: { isActive: true }
            }
          }
        },
        votes: true
      }
    });

    if (!contribution || contribution.roomId !== roomId) {
      throw new Error('作品不存在');
    }

    const vote = await prisma.workshopContributionVote.upsert({
      where: {
        contributionId_memberId: {
          contributionId: params.contributionId,
          memberId: params.memberId
        }
      },
      create: {
        contributionId: params.contributionId,
        memberId: params.memberId,
        voteType: params.voteType
      },
      update: {
        voteType: params.voteType
      }
    });

    workshopEvents.emit(roomId, {
      type: 'vote.update',
      payload: {
        contributionId: params.contributionId,
        memberId: params.memberId,
        voteType: params.voteType
      }
    });

    const activeMembers = contribution.room.members.filter((member) => member.isActive);
    const rewriteVotes = await prisma.workshopContributionVote.count({
      where: {
        contributionId: params.contributionId,
        voteType: 'rewrite'
      }
    });

    if (rewriteVotes > Math.floor(activeMembers.length / 2)) {
      await prisma.workshopContribution.update({
        where: { contributionId: params.contributionId },
        data: { status: 'pending' }
      });

      workshopEvents.emit(roomId, {
        type: 'contribution.status',
        payload: {
          contributionId: params.contributionId,
          status: 'pending'
        }
      });
    }

    return vote;
  },

  async finalizeContribution(contributionId: number, status: WorkshopContributionStatus) {
    const contribution = await prisma.workshopContribution.update({
      where: { contributionId },
      data: { status },
      include: {
        member: true,
        votes: true
      }
    });

    workshopEvents.emit(contribution.roomId, {
      type: 'contribution.status',
      payload: {
        contributionId: contribution.contributionId,
        status: contribution.status
      }
    });

    return contribution;
  }
};
