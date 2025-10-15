import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: 'teacher' | 'student';
    sessionId?: number;
  };
}

export const authenticate = (roles: Array<'teacher' | 'student'>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: '缺少认证信息' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: '认证格式错误' });
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
