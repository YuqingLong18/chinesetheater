import { prisma } from '../lib/prisma.js';
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
