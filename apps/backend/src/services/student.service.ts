import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/password.js';

const adjectives = ['春花', '夏雨', '秋月', '冬雪', '星辰', '晨光', '晚霞', '青柳'];
const nouns = ['云', '风', '竹', '松', '梅', '荷', '燕', '雨'];

const getRandomElement = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const generateCredential = () => {
  const name = `${getRandomElement(adjectives)}${getRandomElement(nouns)}${Math.floor(Math.random() * 90 + 10)}`;
  const password = `${getRandomElement(adjectives)}${Math.floor(Math.random() * 90 + 10)}`;
  return { username: name.slice(0, 8), password: password.slice(0, 10) };
};

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
        passwordHash
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
      isUsed: true,
      firstLoginAt: true,
      lastActivityAt: true
    }
  });
