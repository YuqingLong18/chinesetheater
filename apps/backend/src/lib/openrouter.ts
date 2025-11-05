import { env } from '../config/env.js';

// See https://openrouter.ai/docs#known-issues for html error payloads
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1_000;

type OpenRouterRequestInit = RequestInit & {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number) => [408, 425, 429, 500, 502, 503, 504].includes(status);

const isRetryableNetworkError = (error: Error) => {
  const message = error.message ?? '';
  return (
    error.name === 'FetchError' ||
    message.includes('fetch failed') ||
    message.includes('ECONNRESET') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EAI_AGAIN')
  );
};

export const callOpenRouter = async <T>(path: string, init: OpenRouterRequestInit = {}): Promise<T> => {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    signal: externalSignal,
    ...requestInit
  } = init;

  const retryBackoff = (attempt: number) => retryDelayMs * Math.pow(2, attempt);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let shouldRetry = false;
    let backoffMs = 0;

    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener(
          'abort',
          () => {
            controller.abort(externalSignal.reason);
          },
          { once: true }
        );
      }
    }

    try {
      const response = await fetch(
        `${OPENROUTER_BASE_URL}${path}`,
        withAuthHeaders({
          ...requestInit,
          signal: controller.signal
        })
      );
      const rawText = await response.text();
      const trimmedText = rawText.trim();

      if (response.ok) {
        try {
          if (trimmedText.length === 0) {
            throw new Error('OpenRouter 返回空响应');
          }

          return JSON.parse(trimmedText) as T;
        } catch (error) {
          const snippet = trimmedText.length > 0 ? trimmedText : rawText;
          throw new Error(`OpenRouter 返回非JSON数据: ${snippet.slice(0, 200)}`);
        }
      }

      const snippet = trimmedText.length > 0 ? trimmedText : rawText;
      const error = new Error(`OpenRouter 调用失败: ${response.status} ${snippet}`);
      if (attempt < maxRetries && shouldRetryStatus(response.status)) {
        shouldRetry = true;
        backoffMs = retryBackoff(attempt);
        lastError = error;
      } else {
        throw error;
      }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      const timedOutNow = timedOut && normalized.name === 'AbortError';
      const retryableNetworkError = isRetryableNetworkError(normalized);

      if (attempt < maxRetries && (timedOutNow || retryableNetworkError)) {
        shouldRetry = true;
        backoffMs = retryBackoff(attempt);
        lastError = normalized;
      } else if (timedOutNow) {
        throw new Error(`OpenRouter 请求超时（${timeoutMs}ms）`);
      } else {
        throw normalized;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (shouldRetry) {
      await sleep(backoffMs);
      continue;
    }

    break;
  }

  throw lastError ?? new Error('OpenRouter 请求失败');
};
