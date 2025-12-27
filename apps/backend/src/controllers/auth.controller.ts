import type { Request, Response } from 'express';
import { authenticateTeacher } from '../services/auth.service.js';
import { teacherLoginSchema } from '../schemas/auth.schema.js';
import { findOrCreateStudent } from '../services/student.service.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
// authenticateStudent unused now

export const teacherLogin = async (req: Request, res: Response) => {
  const parseResult = teacherLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '参数错误' });
  }

  try {
    const result = await authenticateTeacher(parseResult.data.username, parseResult.data.password);
    if (!result) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    res.json({
      token: result.token,
      teacher: result.teacher
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '教师登录失败' });
  }
};

export const studentLogin = async (req: Request, res: Response) => {
  // We'll relax the schema check or manually validate since we're changing requirements
  // Ideally, update existing schema in auth.schema.ts, but let's just handle it here for now
  const { sessionPin, username } = req.body; // username acts as nickname

  if (!sessionPin || !username) {
    return res.status(400).json({ message: '请输入课堂PIN码和昵称' });
  }

  try {
    // 1. Verify Session PIN
    const session = await prisma.session.findUnique({
      where: { sessionPin }
    });

    if (!session) {
      return res.status(404).json({ message: '未找到该课堂，请检查PIN码' });
    }

    if (!session.isActive) {
      return res.status(403).json({ message: '该课堂已结束' });
    }

    // 2. Find or Create Student
    const student = await findOrCreateStudent(session.sessionId, username);

    // 3. Issue Token
    const token = signToken({
      sub: student.studentId, // Required by JwtPayload
      studentId: student.studentId,
      sessionId: session.sessionId,
      username: student.username,
      role: 'student'
    });

    res.json({
      token,
      profile: student
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '学生登录失败' });
  }
};
