import { env } from '../config/env.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const withAuthHeaders = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://chinesetheater.local',
    'X-Title': '中文课堂互动平台',
    ...(init.headers || {})
  }
});

export const callOpenRouter = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, withAuthHeaders(init));
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter 调用失败: ${response.status} ${errorText}`);
  }
  return response.json() as Promise<T>;
};
