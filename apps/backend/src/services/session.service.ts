import { prisma } from '../lib/prisma.js';
import type { Session } from '@prisma/client';
import { createSessionTasks, type CreateSessionTaskInput } from './task.service.js';

export const createSession = async (
  centralUserId: number,
  sessionName: string,
  // sessionPin, // Remove argument or make optional, but for now we'll generate internally and ignore input if passed, or better, remove it from signature to enforce change.
  // wait, I need to match the Plan. "Remove proper sessionPin argument".
  authorName: string,
  literatureTitle: string,
  tasks: CreateSessionTaskInput[] = []
): Promise<Session> => {
  // Generate a random 6-character PIN
  const generatePin = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I, O, 1, 0 for readibility
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let sessionPin = generatePin();
  let existingPin = await prisma.session.findUnique({ where: { sessionPin } });

  // Simple retry logic for uniqueness
  let retries = 0;
  while (existingPin && retries < 5) {
    sessionPin = generatePin();
    existingPin = await prisma.session.findUnique({ where: { sessionPin } });
    retries++;
  }

  if (existingPin) {
    throw new Error('Failed to generate unique PIN, please try again');
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.session.create({
      data: {
        centralUserId,
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

export const getTeacherSessions = (centralUserId: number) =>
  prisma.session.findMany({
    where: { centralUserId },
    orderBy: { createdAt: 'desc' }
  });

export const getSessionById = (sessionId: number) =>
  prisma.session.findUnique({
    where: { sessionId },
    select: {
      sessionId: true,
      centralUserId: true,
      sessionName: true,
      authorName: true,
      literatureTitle: true,
      lifeJourneyGeneratedAt: true
    }
  });
