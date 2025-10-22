import { prisma } from '../lib/prisma.js';
import type { Session } from '@prisma/client';
import { refreshSessionLifeJourney } from './journey.service.js';

export const createSession = async (
  teacherId: number,
  sessionName: string,
  sessionPin: string,
  authorName: string,
  literatureTitle: string
): Promise<Session> => {
  const existingPin = await prisma.session.findUnique({ where: { sessionPin } });
  if (existingPin) {
    throw new Error('该会话PIN码已存在，请重新输入');
  }

  const session = await prisma.session.create({
    data: {
      teacherId,
      sessionName,
      sessionPin,
      authorName,
      literatureTitle
    }
  });

  try {
    await refreshSessionLifeJourney(session.sessionId);
    const updated = await prisma.session.findUnique({ where: { sessionId: session.sessionId } });
    if (updated) {
      return updated;
    }
  } catch (error) {
    console.error('预生成人生行迹失败', error);
  }

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
