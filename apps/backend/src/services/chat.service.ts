import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';
import { contentFilter } from '../lib/contentFilter.js';

const buildSystemPrompt = (authorName: string, literatureTitle: string) => `你是${authorName}，《${literatureTitle}》的作者。请基于以下要求与学生对话:
1. 使用第一人称,以作者身份回答问题
2. 结合你的生平经历和创作背景
3. 体现作品中的核心思想和主题
4. 适时引用原作中的经典段落或名句
5. 语言风格符合作者的时代和个人特色
6. 对学生保持鼓励和启发性
7. 所有回复使用中文

学生现在想与你交流,请开始对话。`;

type OpenRouterChatResponse = {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
};

export const sendStudentMessage = async (
  studentId: number,
  sessionId: number,
  message: string
) => {
  const session = await prisma.session.findUnique({ where: { sessionId } });
  if (!session) {
    throw new Error('课堂会话不存在');
  }

  const filterResult = await contentFilter.check(message);
  if (!filterResult.allowed) {
    throw new Error('您的消息包含不当内容，请修改后重试。');
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      studentId_sessionId: {
        studentId,
        sessionId
      }
    },
    create: {
      studentId,
      sessionId
    },
    update: {}
  });

  const studentMessage = await prisma.message.create({
    data: {
      conversationId: conversation.conversationId,
      studentId,
      senderType: 'student',
      content: message
    }
  });

  await prisma.student.update({
    where: { studentId },
    data: { lastActivityAt: new Date() }
  });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.conversationId },
    orderBy: { timestamp: 'asc' },
    take: 10
  });

  const payload = {
    model: env.OPENROUTER_CHAT_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(session.authorName, session.literatureTitle) },
      ...history.map((item) => ({
        role: item.senderType === 'student' ? 'user' : 'assistant',
        content: item.content
      }))
    ]
  };

  const response = await callOpenRouter<OpenRouterChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  const aiReply = response.choices[0]?.message.content ?? '抱歉，我暂时无法回答，请稍后再试。';

  const aiMessage = await prisma.message.create({
    data: {
      conversationId: conversation.conversationId,
      senderType: 'ai',
      content: aiReply
    }
  });

  const updatedConversation = await prisma.conversation.update({
    where: { conversationId: conversation.conversationId },
    data: {
      messageCount: { increment: 2 },
      updatedAt: new Date()
    }
  });

  return {
    conversation: updatedConversation,
    messages: [studentMessage, aiMessage]
  };
};
