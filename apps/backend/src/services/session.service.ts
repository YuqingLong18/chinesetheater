import { prisma } from '../lib/prisma.js';
import type { Session } from '@prisma/client';
import { createSessionTasks, type CreateSessionTaskInput } from './task.service.js';

export const createSession = async (
  teacherId: number,
  sessionName: string,
  sessionPin: string,
  authorName: string,
  literatureTitle: string,
  tasks: CreateSessionTaskInput[] = []
): Promise<Session> => {
  const existingPin = await prisma.session.findUnique({ where: { sessionPin } });
  if (existingPin) {
    throw new Error('该会话PIN码已存在，请重新输入');
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.session.create({
      data: {
        teacherId,
        sessionName,
        sessionPin,
        authorName,
        literatureTitle
      }
    });

    if (tasks.length > 0) {
      await createSessionTasks(created.sessionId, tasks, tx);
    }

    return created;
  });

  return session;
};

export const getSessionWithStudents = (sessionId: number) =>
  prisma.session.findUnique({
    where: { sessionId },
    include: {
      students: true,
      conversations: {
        include: {
          messages: true
        }
      },
      images: true
    }
  });

export const getTeacherSessions = (teacherId: number) =>
  prisma.session.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' }
  });

export const getSessionById = (sessionId: number) =>
  prisma.session.findUnique({
    where: { sessionId },
    select: {
      sessionId: true,
      teacherId: true,
      sessionName: true,
      authorName: true,
      literatureTitle: true,
      lifeJourneyGeneratedAt: true
    }
  });
