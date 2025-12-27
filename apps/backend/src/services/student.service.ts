import { prisma } from '../lib/prisma.js';

export const findOrCreateStudent = async (sessionId: number, nickname: string) => {
  // Check if student exists
  const existing = await prisma.student.findFirst({
    where: {
      sessionId,
      username: nickname
    }
  });

  if (existing) {
    // If exists, update login time and return
    return prisma.student.update({
      where: { studentId: existing.studentId },
      data: {
        lastActivityAt: new Date(),
        // We can update firstLoginAt if it was null, but it should be set on create
      }
    });
  }

  // Create new student
  return prisma.student.create({
    data: {
      sessionId,
      username: nickname,
      passwordHash: undefined as any, // Bypass TS error until type gen syncs
      firstLoginAt: new Date(),
      lastActivityAt: new Date(),
      isUsed: true // Mark as used immediately
    }
  });
};

export const deleteStudent = async (studentId: number) => {
  return prisma.student.delete({
    where: { studentId }
  });
};

export const listStudentsForSession = (sessionId: number) =>
  prisma.student.findMany({
    where: { sessionId },
    orderBy: { studentId: 'asc' },
    select: {
      studentId: true,
      username: true,
      isUsed: true,
      firstLoginAt: true,
      lastActivityAt: true
    }
  });
