import { env } from '../config/env.js';

// See https://openrouter.ai/docs#known-issues for html error payloads
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const withAuthHeaders = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://chinesetheater.local',
    'X-Title': 'Chinese Classroom Platform',
    ...(init.headers || {})
  }
});

export const callOpenRouter = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, withAuthHeaders(init));
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`OpenRouter 调用失败: ${response.status} ${rawText}`);
  }

  try {
    return JSON.parse(rawText) as T;
  } catch (error) {
    throw new Error(`OpenRouter 返回非JSON数据: ${rawText.slice(0, 200)}`);
  }
};
