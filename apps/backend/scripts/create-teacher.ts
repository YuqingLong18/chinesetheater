import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { createTeacher } from '../src/services/auth.service.js';

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('用法: npx tsx scripts/create-teacher.ts <用户名> <密码>');
  process.exit(1);
}

const run = async () => {
  try {
    const teacher = await createTeacher(username, password);
    console.log('教师账号创建成功:', teacher.username);
  } catch (error) {
    console.error('创建失败:', (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }
};

void run();
