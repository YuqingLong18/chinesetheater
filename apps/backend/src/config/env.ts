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
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY 未配置'),
  OPENROUTER_CHAT_MODEL: z.string().default('anthropic/claude-3.5-sonnet'),
  OPENROUTER_IMAGE_MODEL: z.string().default('openai/dall-e-3'),
  CENTRAL_AUTH_URL: z.string().default('http://localhost:3000')
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
