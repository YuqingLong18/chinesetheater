import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/password.js';

const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const createRandomString = (length: number) =>
  Array.from({ length }, () => CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]).join('');

const generateCredential = () => ({
  username: createRandomString(4),
  password: createRandomString(4)
});

export const createStudentAccounts = async (sessionId: number, quantity: number) => {
  const created: Array<{ username: string; password: string }> = [];

  for (let i = 0; i < quantity; i += 1) {
    let credential = generateCredential();

    let exists = await prisma.student.findFirst({
      where: {
        sessionId,
        username: credential.username
      }
    });

    let retries = 0;
    while (exists && retries < 5) {
      credential = generateCredential();
      exists = await prisma.student.findFirst({
        where: {
          sessionId,
          username: credential.username
        }
      });
      retries += 1;
    }

    const passwordHash = await hashPassword(credential.password);

    await prisma.student.create({
      data: {
        sessionId,
        username: credential.username,
        passwordHash,
        initialPassword: credential.password
      }
    });

    created.push(credential);
  }

  return created;
};

export const listStudentsForSession = (sessionId: number) =>
  prisma.student.findMany({
    where: { sessionId },
    orderBy: { studentId: 'asc' },
    select: {
      studentId: true,
      username: true,
      initialPassword: true,
      isUsed: true,
      firstLoginAt: true,
      lastActivityAt: true
    }
  });
