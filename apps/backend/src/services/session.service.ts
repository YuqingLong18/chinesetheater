import { prisma } from '../lib/prisma.js';
import type { Session } from '@prisma/client';

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

  return prisma.session.create({
    data: {
      teacherId,
      sessionName,
      sessionPin,
      authorName,
      literatureTitle
    }
  });
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
