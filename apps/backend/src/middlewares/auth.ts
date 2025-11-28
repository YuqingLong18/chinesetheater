import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

export interface AuthRequest extends Request {
  user?: {
    id: number; // Central user ID for teachers, local studentId for students
    role: 'teacher' | 'student';
    sessionId?: number;
  };
}

const extractToken = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const queryToken = (req.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryToken === 'string') {
    return queryToken;
  }
  if (Array.isArray(queryToken)) {
    const first = queryToken.find((value): value is string => typeof value === 'string');
    if (first) {
      return first;
    }
  }
  return null;
};

export const authenticate = (roles: Array<'teacher' | 'student'>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: '缺少认证信息' });
    }

    try {
      const payload = verifyToken(token);
      if (!roles.includes(payload.role)) {
        return res.status(403).json({ message: '没有访问权限' });
      }

      req.user = {
        id: payload.sub,
        role: payload.role,
        sessionId: payload.sessionId
      };

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: '认证失败' });
    }
  };
