import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 未配置'),
  DATABASE_PROVIDER: z
    .enum(['mysql', 'postgresql', 'sqlite', 'sqlserver'])
    .default('postgresql'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET 未配置'),

  // Volcengine Config
  VOLCENGINE_API_KEY: z.string().min(1, 'VOLCENGINE_API_KEY 未配置'),
  VOLCENGINE_CHAT_MODEL: z.string().default('doubao-pro-32k-241215'),
  VOLCENGINE_IMAGE_MODEL: z.string().default('doubao-image-gen-001'),
  VOLCENGINE_MODERATION_MODEL: z.string().optional(),

  // Legacy/Optional
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_CHAT_MODEL: z.string().optional(),
  OPENROUTER_IMAGE_MODEL: z.string().optional(),
  CENTRAL_AUTH_URL: z.string().default('http://localhost:3000')
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
