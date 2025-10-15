import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: number;
  role: 'teacher' | 'student';
  sessionId?: number;
}

export const signToken = (payload: JwtPayload, expiresIn = '12h') =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn });

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as JwtPayload;
