import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';

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

const buildJourneyPrompt = (authorName: string, literatureTitle: string) => `请基于以下要求，仅以 JSON 形式返回数据：
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
2. 经纬度请使用十进制小数，精确到0.01；
3. 诗句需为原文，不要简化；
4. 所有输出使用标准 JSON，不可包含额外文本。
5. 若不确定经纬度，可提供大致位置但应在对应地理区域内。
如果该作者地理轨迹较少，可加入相关地点的人文背景。`;

export const generateLifeJourney = async (sessionId: number) => {
  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    throw new Error('课堂会话不存在');
  }

  const payload = {
    model: env.OPENROUTER_CHAT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          '你是一位擅长根据人物生平生成行迹地图的数据专家，请严格按照用户指定的 JSON 模板返回数据，禁止输出其他文字。'
      },
      {
        role: 'user',
        content: buildJourneyPrompt(session.authorName, session.literatureTitle)
      }
    ]
  };

  const response = await callOpenRouter<{ choices?: Array<{ message?: { content?: string } }> }>(
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify(payload)
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
    throw new Error(`生成数据不完整：${validation.error.issues[0]?.message ?? '未知错误'}`);
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
