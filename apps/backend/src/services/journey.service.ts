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
  events: z.array(z.string().min(1)).min(1).catch(['重要事件待补充']),
  geography: geographySchema.catch({
    terrain: '未知',
    vegetation: '未知',
    water: '未知',
    climate: '未知'
  }),
  poems: z.array(poemSchema).min(1).catch([{ title: '待补充', content: '待补充' }])
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
  entries?: LifeJourneyEntryInput[];
}

export interface LifeJourneyEntryInput {
  startYear?: number | null;
  endYear?: number | null;
  ancientName?: string | null;
  modernName?: string | null;
  events?: string | null;
  geography?: string | null;
  poems?: string | null;
}

export interface StoredLifeJourney {
  journey: LifeJourneyResponse;
  generatedAt: Date | null;
}

const hasAnyField = (entry: LifeJourneyEntryInput): boolean => {
  return !!(
    entry.startYear ||
    entry.endYear ||
    (entry.ancientName && entry.ancientName.trim()) ||
    (entry.modernName && entry.modernName.trim()) ||
    (entry.events && entry.events.trim()) ||
    (entry.geography && entry.geography.trim()) ||
    (entry.poems && entry.poems.trim())
  );
};

const formatEntryForPrompt = (entry: LifeJourneyEntryInput, index: number): string => {
  const parts: string[] = [];
  if (entry.startYear || entry.endYear) {
    const period = entry.startYear && entry.endYear
      ? `${entry.startYear}年 - ${entry.endYear}年`
      : entry.startYear
        ? `${entry.startYear}年 - ?`
        : entry.endYear
          ? `? - ${entry.endYear}年`
          : '';
    if (period) parts.push(`时间段：${period}`);
  }
  if (entry.ancientName?.trim()) {
    parts.push(`古代地名：${entry.ancientName.trim()}`);
  }
  if (entry.modernName?.trim()) {
    parts.push(`现代地名：${entry.modernName.trim()}`);
  }
  if (entry.events?.trim()) {
    parts.push(`关键事件：${entry.events.trim()}`);
  }
  if (entry.geography?.trim()) {
    parts.push(`地理风物：${entry.geography.trim()}`);
  }
  if (entry.poems?.trim()) {
    parts.push(`代表诗作：${entry.poems.trim()}`);
  }
  return `条目${index + 1}：${parts.join('；')}`;
};

const buildJourneyPrompt = (authorName: string, literatureTitle: string, entries?: LifeJourneyEntryInput[]) => {
  const validEntries = entries?.filter(hasAnyField) ?? [];
  const teacherGuidanceBlock = validEntries.length > 0
    ? `
重要：教师提供了以下必须严格遵循的行迹条目（每个条目至少有一个字段已填写）。对于这些条目：
1. 必须完整保留教师提供的所有信息（时间段、地名、事件、地理风物、诗作等）
2. 对于教师未填写的字段，AI需要根据历史资料合理补充
3. 时间段格式：如果提供了起始年份和终止年份，使用"起始年 - 终止年"格式；如果只提供了其中一个，使用"起始年 - ?"或"? - 终止年"格式
4. 地名：如果提供了古代地名和现代地名，两者都必须保留；如果只提供了其中一个，AI需要补充另一个
5. 关键事件：如果教师提供了事件描述，必须保留；如果未提供，AI需要根据该时间段和地点补充相关事件
6. 地理风物：如果教师提供了地理风物描述，必须保留；如果未提供，AI需要根据该地点补充
7. 代表诗作：如果教师提供了诗作信息，必须保留；如果未提供，AI需要根据该时间段和地点补充相关诗作

教师提供的条目：
${validEntries.map((entry, index) => formatEntryForPrompt(entry, index)).join('\n')}

除了上述教师提供的条目外，AI还需要：
1. 继续补全该作者人生行迹的其他重要阶段和地点，确保生成至少6个地点，涵盖${authorName}人生主要阶段
2. **特别注意时间连贯性**：如果教师提供的条目之间存在时间空白，AI必须尽量搜集历史资料，在空白处补充中间阶段的地点，确保时间连贯。例如，如果教师提供了705年的条目和724年的条目，AI应该在705-724年之间补充中间阶段的地点
3. 所有地点必须按时间顺序排列，相邻地点的时间段应该尽量连续`
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
1. ${validEntries.length > 0 ? '首先，必须严格按照教师提供的条目生成对应的地点，保留教师提供的所有信息，并补充缺失字段。然后，' : ''}生成至少6个地点，涵盖${authorName}人生主要阶段；

2. **时间连贯性要求（非常重要）**：
   - locations数组必须按照时间顺序排列（从早到晚）
   - 相邻地点的时间段应该尽量连续，避免出现大的时间空白（如上一个地点到705年，下一个地点就从724年开始）
   - 请尽量搜集历史资料，在时间空白处补充中间阶段的地点或事件
   - 如果某个时间段确实没有确切的史料记载，可以跳过，但应尽量缩小时间间隔
   - 每个地点的period字段必须准确反映该阶段的时间范围，格式为"起始年 - 终止年"

3. 每个地点必须包含：
   - 至少1个关键事件（events数组不能为空）
   - 至少1首代表诗作（poems数组不能为空，包含title和content）

4. 经纬度请使用十进制小数，精确到0.01；

5. 诗句需为原文，不要简化；

6. 所有输出使用标准 JSON，不可包含额外文本。

7. 若不确定经纬度，可提供大致位置但应在对应地理区域内。

8. 每个地点的events和poems数组必须至少包含1个元素。

9. 对于教师提供的条目，period字段必须使用"起始年 - 终止年"格式，如果只提供了起始年或终止年，使用"起始年 - ?"或"? - 终止年"格式。

10. 请仔细查阅历史资料，确保生成的行迹时间连贯，尽量填补时间空白。如果确实存在无法填补的空白，请在routeNotes中简要说明原因。${teacherGuidanceBlock}

如果该作者地理轨迹较少，可加入相关地点的人文背景。`;
};

const parseStoredJourney = (value: unknown) => {
  if (!value) {
    return null;
  }
  const parsed = lifeJourneySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const storeLifeJourney = async (
  sessionId: number,
  journey: LifeJourneyResponse,
  rawResponse?: string,
  attemptNumber: number = 1
) => {
  await prisma.session.update({
    where: { sessionId },
    data: {
      lifeJourney: journey,
      lifeJourneyGeneratedAt: new Date(),
      lifeJourneyRawResponse: rawResponse ?? null,
      lifeJourneyModel: env.OPENROUTER_CHAT_MODEL,
      lifeJourneyAttempts: attemptNumber
    }
  });
};

export const generateLifeJourney = async (sessionId: number, options: GenerateLifeJourneyOptions = {}) => {
  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    throw new Error('课堂会话不存在');
  }

  const validEntries = options.entries?.filter(hasAnyField) ?? [];

  const payload = {
    model: env.OPENROUTER_CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          '你是一位擅长根据人物生平生成行迹地图的数据专家。请严格按照用户指定的 JSON 模板返回数据，禁止输出其他文字。\n\n重要要求：\n- 每个地点的 events 数组必须包含至少1个非空字符串\n- 每个地点的 poems 数组必须包含至少1个对象，每个对象必须包含 title 和 content 字段\n- locations 数组必须包含至少3个地点，且必须按时间顺序排列（从早到晚）\n- 所有字段都必须符合模板要求\n- 如果用户提供了必须遵循的条目，必须严格保留用户提供的所有信息，并补充缺失的字段\n- **时间连贯性至关重要**：请尽量搜集历史资料，确保相邻地点的时间段连续，避免出现大的时间空白。如果确实存在无法填补的空白，请在routeNotes中说明'
      },
      {
        role: 'user',
        content: buildJourneyPrompt(session.authorName, session.literatureTitle, validEntries.length > 0 ? validEntries : undefined)
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
    const strategies = [
      // Strategy 1: Direct parse
      () => JSON.parse(text.trim()),

      // Strategy 2: Markdown code block with optional json language tag
      () => {
        const match = text.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
        return match ? JSON.parse(match[1]) : null;
      },

      // Strategy 3: Find first { to last }
      () => {
        const first = text.indexOf('{');
        const last = text.lastIndexOf('}');
        return (first !== -1 && last > first) ? JSON.parse(text.slice(first, last + 1)) : null;
      },

      // Strategy 4: Fix common JSON errors
      () => {
        const fixed = text
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/\/\/.*/g, '') // Remove // comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ comments
        return JSON.parse(fixed);
      },

      // Strategy 5: Try to extract from markdown block then fix errors
      () => {
        const match = text.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
        if (!match) return null;
        const fixed = match[1]
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\/\/.*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        return JSON.parse(fixed);
      }
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result) {
          console.log(`JSON extraction succeeded with strategy ${i + 1}`);
          return result;
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    return null;
  };



  const parsed = extractJsonCandidate(raw);
  if (!parsed) {
    // Log detailed information for debugging
    console.error('Failed to parse JSON from LLM response:', {
      responseLength: raw.length,
      firstChars: raw.substring(0, 200),
      lastChars: raw.substring(Math.max(0, raw.length - 200)),
      model: env.OPENROUTER_CHAT_MODEL,
      sessionId
    });

    throw new Error(`生成失败：模型返回的不是合法 JSON。响应长度: ${raw.length}字符。请重试或联系管理员。`);
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

  const journey = {
    ...validation.data,
    locations: withIds
  } satisfies LifeJourneyResponse;

  return {
    journey,
    rawResponse: raw
  };
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

  const { journey, rawResponse } = await generateLifeJourney(sessionId);
  await storeLifeJourney(sessionId, journey, rawResponse);
  return journey;
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
  const { journey, rawResponse } = await generateLifeJourney(sessionId, options);

  // Only store if generation succeeded and validated correctly
  // If this throws, the existing journey remains unchanged
  await storeLifeJourney(sessionId, journey, rawResponse);


  return journey;
};
