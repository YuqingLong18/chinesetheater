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
  WorkshopVoteType
} from '@prisma/client';
import { workshopEvents } from './workshopEvents.service.js';

const WORKSHOP_CODE_LENGTH = 6;

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
        },
        include: {
          members: true
        }
      });

      return room;
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

  async listRoomsForTeacher(teacherId: number) {
    return prisma.workshopRoom.findMany({
      where: {
        members: {
          some: {
            teacherId,
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
            votes: true
          }
        },
        chats: {
          orderBy: { createdAt: 'asc' }
        }
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
          orderBy: { orderIndex: 'desc' },
          take: 1
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

    const currentOrder = room.currentTurnOrder ?? 0;
    const currentMemberId = room.members[currentOrder]?.memberId ?? room.members[0]?.memberId;
    if (!currentMemberId || currentMemberId !== params.memberId) {
      throw new Error('尚未轮到你提交');
    }

    const nextOrder = room.members.length > 0 ? (memberOrder + 1) % room.members.length : 0;
    const orderIndex = (room.contributions[0]?.orderIndex ?? -1) + 1;

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
          votes: true
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
        votes: true
      }
    });

    workshopEvents.emit(roomId, {
      type: 'contribution.feedback',
      payload: contribution
    });

    return contribution;
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
