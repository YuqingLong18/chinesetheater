import type { Request, Response } from 'express';
import { authenticateTeacher, authenticateStudent } from '../services/auth.service.js';
import { teacherLoginSchema, studentLoginSchema } from '../schemas/auth.schema.js';

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
  const parseResult = studentLoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: parseResult.error.issues[0]?.message ?? '参数错误' });
  }

  try {
    const { sessionPin, username, password } = parseResult.data;
    const result = await authenticateStudent(sessionPin, username, password);
    if (!result) {
      return res.status(401).json({ message: '登录信息不正确' });
    }

    res.json({
      token: result.token,
      profile: result.student
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '学生登录失败' });
  }
};
