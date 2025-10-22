import { prisma } from '../lib/prisma.js';
import type { WorkshopSuggestionType } from '@prisma/client';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';
import { workshopService } from './workshop.service.js';

const parseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/```json\s*([\s\S]+?)```/i);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (inner) {
        return null;
      }
    }
    return null;
  }
};

export const evaluateRelayContribution = async (roomId: number, contributionId: number) => {
  const contribution = await prisma.workshopContribution.findUnique({
    where: { contributionId },
    include: {
      room: {
        include: {
          contributions: {
            orderBy: { orderIndex: 'asc' },
            include: {
              member: true
            }
          }
        }
      },
      member: true
    }
  });

  if (!contribution || contribution.roomId !== roomId) {
    return;
  }

  if (contribution.room.mode !== 'relay') {
    return;
  }

  const previousLines = contribution.room.contributions
    .filter((item) => item.orderIndex < contribution.orderIndex)
    .map((item) => item.content.trim())
    .join('\n');

  const prompt = `请以古诗词导师身份审阅学生创作。
创作主题：${contribution.room.theme ?? '未指定'}
格律要求：${contribution.room.meterRequirement ?? '自由发挥'}
前文：
${previousLines || '（暂无前文）'}

新提交诗句：${contribution.content}

请使用如下 JSON 格式返回点评：
{
  "meter": { "score": 0-10, "comment": "格律评价" },
  "diction": { "score": 0-10, "comment": "用词评价" },
  "coherence": { "score": 0-10, "comment": "衔接评价" },
  "imagery": { "score": 0-10, "comment": "意境评价" },
  "suggestions": ["若干条改进建议"],
  "encouragement": "一句鼓励的话"
}
严禁输出JSON外的其他内容。`;

  let feedback: unknown;
  try {
    const response = await callOpenRouter<{ choices?: Array<{ message?: { content?: string } }> }>(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: env.OPENROUTER_CHAT_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一名温暖的古诗词导师，擅长在格律与意境之间给予学生建设性反馈。严格遵守用户给定的JSON格式。'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      }
    );

    const raw = response.choices?.[0]?.message?.content ?? '';
    feedback = parseJson(raw) ?? { error: '解析失败', raw };
  } catch (error) {
    feedback = { error: (error as Error).message };
  }

  await workshopService.recordFeedback(roomId, contributionId, feedback as any);
};

export const generateAdaptationSuggestions = async (
  roomId: number,
  boardId?: number
): Promise<Array<{ type: WorkshopSuggestionType; content: string }>> => {
  const room = await prisma.workshopRoom.findUnique({
    where: { roomId },
    include: {
      boards: {
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        }
      },
      contributions: {
        orderBy: { createdAt: 'asc' },
        include: {
          member: true
        }
      }
    }
  });

  if (!room || room.mode !== 'adaptation') {
    return [];
  }

  const boardSummaries = room.boards
    .map((board) => `【${board.title}】\n${board.content.slice(0, 400)}`)
    .join('\n\n');

  const relayLines = room.contributions
    .slice(-6)
    .map((item) => `${item.member?.nickname ?? '成员'}：${item.content}`)
    .join('\n');

  const prompt = `你是一位古诗词改编导师，帮助学生将经典作品改写为现代体裁。\n` +
    `创作讨论板概览：\n${boardSummaries}\n\n` +
    `近期创作片段：\n${relayLines || '（暂无接龙内容）'}\n\n` +
    `请根据以上信息，提供 3 条具体建议，返回 JSON 数组，每条包含：\n` +
    `[{"type":"structure|imagery|diction|pacing|spirit","content":"详尽建议文本"},...]\n` +
    `- type 请从给定枚举中选择\n- 用正向、鼓励式语言给出操作性建议\n- 长度控制在 120 字以内\n- 严格返回 JSON 数组，不要附加其他文字`;

  try {
    const response = await callOpenRouter<{ choices?: Array<{ message?: { content?: string } }> }>(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({
          model: env.OPENROUTER_CHAT_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一位温柔的古典文学导师，擅长保持原作精神并提出现代化建议。严格按照用户给定的 JSON 输出。'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      }
    );

    const raw = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseJson(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const allowed: WorkshopSuggestionType[] = ['structure', 'imagery', 'diction', 'pacing', 'spirit'];

    return parsed
      .map((item) => {
        const type = typeof item.type === 'string' && allowed.includes(item.type as WorkshopSuggestionType)
          ? (item.type as WorkshopSuggestionType)
          : 'structure';
        return {
          type,
          content: typeof item.content === 'string' ? item.content : ''
        };
      })
      .filter((item) => item.content);
  } catch (error) {
    console.error('[workshop.ai] 生成改编建议失败', error);
    return [];
  }
};
