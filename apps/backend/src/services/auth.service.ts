import { prisma } from '../lib/prisma.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { verifyCentralCredentials } from '../lib/centralAuth.js';

/**
 * Authenticate teacher using centralized authentication
 */
export const authenticateTeacher = async (username: string, password: string) => {
  // Verify credentials with centralized auth server
  const centralUser = await verifyCentralCredentials(username, password);
  if (!centralUser) {
    return null;
  }

  // Generate JWT token with central user ID
  const token = signToken({ sub: centralUser.id, role: 'teacher' });
  return {
    token,
    teacher: {
      id: centralUser.id,
      username: centralUser.username
    }
  };
};

export const authenticateStudent = async (sessionPin: string, username: string, password: string) => {
  const session = await prisma.session.findUnique({
    where: { sessionPin },
    include: { students: { where: { username } } }
  });

  if (!session) {
    return null;
  }

  const student = session.students[0];
  if (!student) {
    return null;
  }

  if (!student.passwordHash) {
    return null;
  }

  const isValid = await comparePassword(password, student.passwordHash);
  if (!isValid) {
    return null;
  }

  if (!student.isUsed) {
    await prisma.student.update({
      where: { studentId: student.studentId },
      data: { isUsed: true, firstLoginAt: new Date(), lastActivityAt: new Date() }
    });
  } else {
    await prisma.student.update({
      where: { studentId: student.studentId },
      data: { lastActivityAt: new Date() }
    });
  }

  const token = signToken({ sub: student.studentId, role: 'student', sessionId: session.sessionId });

  return {
    token,
    student: {
      id: student.studentId,
      username: student.username,
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      authorName: session.authorName,
      literatureTitle: session.literatureTitle
    }
  };
};

export const createTeacher = async (username: string, password: string) => {
  const existing = await prisma.teacher.findUnique({ where: { username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  const passwordHash = await hashPassword(password);
  const teacher = await prisma.teacher.create({
    data: { username, passwordHash }
  });

  return teacher;
};
