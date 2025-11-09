import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';

const LIFE_JOURNEY_TIMEOUT_MS = 300_000; // 5分钟
const LIFE_JOURNEY_RETRY_DELAY_MS = 5_000;
const LIFE_JOURNEY_MAX_RETRIES = 1;

const poemSchema = z.object({
  title: z.string(),
  content: z.string()
});

const geographySchema = z.object({
  terrain: z.string().nonempty(),
  vegetation: z.string().nonempty(),
  water: z.string().nonempty(),
  climate: z.string().nonempty()
});

const journeyLocationSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  modernName: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  period: z.string().min(1),
  description: z.string().min(1),
  events: z.array(z.string().min(1)).min(1),
  geography: geographySchema,
  poems: z.array(poemSchema).min(1)
});

const lifeJourneySchema = z.object({
  heroName: z.string(),
  summary: z.string(),
  locations: z.array(journeyLocationSchema).min(3),
  highlights: z.array(z.string()).optional().default([]),
  routeNotes: z.string().optional().nullable()
});

export type LifeJourneyResponse = z.infer<typeof lifeJourneySchema>;

export interface GenerateLifeJourneyOptions {
  instructions?: string;
}

export interface StoredLifeJourney {
  journey: LifeJourneyResponse;
  generatedAt: Date | null;
}

const sanitizeTeacherInstructions = (input?: string): string[] => {
  if (!input) {
    return [];
  }
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/`/g, '´'));
};

const buildJourneyPrompt = (authorName: string, literatureTitle: string, instructions?: string) => {
  const teacherGuidance = sanitizeTeacherInstructions(instructions);
  const teacherGuidanceBlock = teacherGuidance.length
    ? `
附加要求：
- 以下教师提供的行迹信息必须完整保留（不可改写时间段与地点名称，可补充细节）：
${teacherGuidance.map((line, index) => `${index + 1}. ${line}`).join('\n')}
- 如果教师提供了经纬度，请直接使用；若未提供，请在相应地理区域内合理推断。
- 可根据需要为同一地点补充事件与诗作，但不得删除上述信息。`
    : '';

  return `请基于以下要求，仅以 JSON 形式返回数据：
{
  "heroName": "${authorName}",
  "summary": "简要概述其一生行迹",
  "locations": [
    {
      "name": "地点名称（尽量使用常见中文地名）",
      "modernName": "现代称谓",
      "latitude": 0,
      "longitude": 0,
      "period": "yyyy年 - yyyy年",
      "description": "该阶段发生的概述",
      "events": ["关键事件，使用精炼中文"],
      "geography": {
        "terrain": "地形风貌",
        "vegetation": "植被特色",
        "water": "水域风貌，引用相关诗句",
        "climate": "气候特点，可引用诗句"
      },
      "poems": [
        { "title": "代表作品", "content": "相关诗句原文" }
      ]
    }
  ],
  "highlights": ["用一句话概括的重要节点"],
  "routeNotes": "补充说明"
}
要求：
1. 生成至少6个地点，涵盖${authorName}人生主要阶段；
2. 每个地点必须包含：
   - 至少1个关键事件（events数组不能为空）
   - 至少1首代表诗作（poems数组不能为空，包含title和content）
3. 经纬度请使用十进制小数，精确到0.01；
4. 诗句需为原文，不要简化；
5. 所有输出使用标准 JSON，不可包含额外文本。
6. 若不确定经纬度，可提供大致位置但应在对应地理区域内。
7. 每个地点的events和poems数组必须至少包含1个元素。${teacherGuidanceBlock}
如果该作者地理轨迹较少，可加入相关地点的人文背景。`;
};

const parseStoredJourney = (value: unknown) => {
  if (!value) {
    return null;
  }
  const parsed = lifeJourneySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const storeLifeJourney = async (sessionId: number, journey: LifeJourneyResponse) => {
  await prisma.session.update({
    where: { sessionId },
    data: {
      lifeJourney: journey,
      lifeJourneyGeneratedAt: new Date()
    }
  });
};

export const generateLifeJourney = async (sessionId: number, options: GenerateLifeJourneyOptions = {}) => {
  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    throw new Error('课堂会话不存在');
  }

  const trimmedInstructions = options.instructions?.trim();
  const normalizedInstructions =
    trimmedInstructions && trimmedInstructions.length > 0 ? trimmedInstructions : undefined;

  const payload = {
    model: env.OPENROUTER_CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          '你是一位擅长根据人物生平生成行迹地图的数据专家。请严格按照用户指定的 JSON 模板返回数据，禁止输出其他文字。\n\n重要要求：\n- 每个地点的 events 数组必须包含至少1个非空字符串\n- 每个地点的 poems 数组必须包含至少1个对象，每个对象必须包含 title 和 content 字段\n- locations 数组必须包含至少3个地点\n- 所有字段都必须符合模板要求'
      },
      {
        role: 'user',
        content: buildJourneyPrompt(session.authorName, session.literatureTitle, normalizedInstructions)
      }
    ]
  };

  const response = await callOpenRouter<{ choices?: Array<{ message?: { content?: string } }> }>(
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: LIFE_JOURNEY_TIMEOUT_MS,
      maxRetries: LIFE_JOURNEY_MAX_RETRIES,
      retryDelayMs: LIFE_JOURNEY_RETRY_DELAY_MS
    }
  );

  const raw = response.choices?.[0]?.message?.content ?? '';

  const tryParseJson = (text: string): unknown | null => {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  };

  const extractJsonCandidate = (text: string): unknown | null => {
    const trimmed = text.trim();
    const direct = tryParseJson(trimmed);
    if (direct) {
      return direct;
    }

    const fenced = trimmed.match(/```json\s*([\s\S]+?)```/i);
    if (fenced) {
      const attempt = tryParseJson(fenced[1]);
      if (attempt) {
        return attempt;
      }
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const slice = trimmed.slice(firstBrace, lastBrace + 1);
      const attempt = tryParseJson(slice);
      if (attempt) {
        return attempt;
      }
    }

    return null;
  };

  const parsed = extractJsonCandidate(raw);
  if (!parsed) {
    throw new Error('生成失败：模型返回的不是合法 JSON');
  }

  const validation = lifeJourneySchema.safeParse(parsed);
  if (!validation.success) {
    // Provide more detailed error messages
    const issues = validation.error.issues;
    const errorMessages = issues.map((issue) => {
      const path = issue.path.join('.');
      // Extract location index if available
      const locationMatch = path.match(/locations\[(\d+)\]/);
      const locationIndex = locationMatch ? parseInt(locationMatch[1], 10) + 1 : null;
      const locationPrefix = locationIndex ? `第${locationIndex}个地点` : '某些地点';
      
      if (path.includes('events')) {
        return `${locationPrefix}缺少关键事件（events），每个地点至少需要1个事件`;
      }
      if (path.includes('poems')) {
        return `${locationPrefix}缺少代表诗作（poems），每个地点至少需要1首诗`;
      }
      if (path.includes('locations') && path.includes('length')) {
        return '地点数量不足，至少需要3个地点';
      }
      return `${path}: ${issue.message}`;
    });
    
    // Log the raw response for debugging
    console.error('Life journey validation failed:', {
      error: errorMessages[0],
      issues: issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      rawResponseLength: raw.length,
      parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : []
    });
    
    throw new Error(`生成数据不完整：${errorMessages[0] ?? '未知错误'}`);
  }

  // 为缺失 id 的地点补充递增 id
  const withIds = validation.data.locations.map((location, index) => ({
    ...location,
    id: location.id ?? index + 1
  }));

  return {
    ...validation.data,
    locations: withIds
  } satisfies LifeJourneyResponse;
};

export const ensureSessionLifeJourney = async (sessionId: number): Promise<LifeJourneyResponse> => {
  const session = await prisma.session.findUnique({
    where: { sessionId },
    select: {
      lifeJourney: true
    }
  });

  const existing = parseStoredJourney(session?.lifeJourney ?? null);
  if (existing) {
    return existing;
  }

  const generated = await generateLifeJourney(sessionId);
  await storeLifeJourney(sessionId, generated);
  return generated;
};

export const getStoredLifeJourney = async (sessionId: number): Promise<StoredLifeJourney | null> => {
  const session = await prisma.session.findUnique({
    where: { sessionId },
    select: {
      lifeJourney: true,
      lifeJourneyGeneratedAt: true
    }
  });

  const existing = parseStoredJourney(session?.lifeJourney ?? null);
  if (!existing) {
    return null;
  }

  return {
    journey: existing,
    generatedAt: session?.lifeJourneyGeneratedAt ?? null
  };
};

/**
 * Regenerates and stores a new life journey for a session.
 * Only updates the database if generation succeeds and validates correctly.
 * Throws an error if generation or validation fails, leaving existing data unchanged.
 */
export const refreshSessionLifeJourney = async (
  sessionId: number,
  options: GenerateLifeJourneyOptions = {}
): Promise<LifeJourneyResponse> => {
  // Generate new journey - throws error if generation or validation fails
  const generated = await generateLifeJourney(sessionId, options);
  
  // Only store if generation succeeded and validated correctly
  // If this throws, the existing journey remains unchanged
  await storeLifeJourney(sessionId, generated);
  
  return generated;
};
