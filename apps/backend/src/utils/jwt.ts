import jwt, { type Secret } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: number;
  role: 'teacher' | 'student';
  sessionId?: number;
}

const secret: Secret = env.JWT_SECRET;

export const signToken = (payload: JwtPayload, expiresIn: jwt.SignOptions['expiresIn'] = '12h') =>
  jwt.sign(payload, secret, { expiresIn });

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('无效的令牌');
  }

  const maybePayload = decoded as jwt.JwtPayload;
  const { sub, role, sessionId } = maybePayload;

  if (typeof sub !== 'number' || (role !== 'teacher' && role !== 'student')) {
    throw new Error('无效的令牌');
  }

  return {
    sub,
    role,
    sessionId: typeof sessionId === 'number' ? sessionId : undefined
  };
};
