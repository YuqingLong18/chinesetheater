import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';

interface OpenRouterImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    base64?: string;
  }>;
}

interface OpenRouterChatImageChoice {
  message?: {
    images?: Array<
      | string
      | {
          image_url?: { url?: string } | string;
          url?: string;
          image_base64?: string;
          b64_json?: string;
          base64?: string;
        }
    >;
    content?: Array<
      | string
      | {
          type?: string;
          text?: string;
          url?: string;
          image_url?: string;
          image_base64?: string;
          data?: string;
        }
    >;
  };
}

interface OpenRouterChatImageResponse {
  choices?: OpenRouterChatImageChoice[];
}

const toDataUrl = (base64: string, mime = 'image/png') =>
  base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;

const resolveImageFromChatResponse = (response: OpenRouterChatImageResponse): string => {
  const choice = response.choices?.[0];
  const message = choice?.message;

  const directImages = Array.isArray(message?.images) ? message?.images : [];
  for (const item of directImages) {
    if (!item) continue;
    if (typeof item === 'string') {
      if (item.startsWith('http') || item.startsWith('data:')) {
        return item;
      }
      continue;
    }

    const candidateUrl =
      typeof item.image_url === 'string'
        ? item.image_url
        : item.image_url?.url ?? item.url;
    if (candidateUrl && (candidateUrl.startsWith('http') || candidateUrl.startsWith('data:'))) {
      return candidateUrl;
    }

    const base64 = item.image_base64 ?? item.b64_json ?? item.base64;
    if (base64) {
      return toDataUrl(base64);
    }
  }

  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (!part) continue;
      if (typeof part === 'string') {
        if (part.startsWith('http') || part.startsWith('data:')) {
          return part;
        }
        continue;
      }

      const maybeUrl = part.image_url ?? part.url;
      if (maybeUrl && (maybeUrl.startsWith('http') || maybeUrl.startsWith('data:'))) {
        return maybeUrl;
      }

      const base64 =
        part.image_base64 ?? (part as { inline_data?: { data?: string } }).inline_data?.data ?? part.data;
      if (base64) {
        return toDataUrl(base64);
      }

      if (part.type === 'output_image' && part.text && part.text.startsWith('data:')) {
        return part.text;
      }
    }
  }

  throw new Error('图像生成失败：响应中缺少图像数据');
};

const shouldUseImagesEndpoint = (model: string) => model.startsWith('openai/dall-e');

export const generateImage = async (
  studentId: number,
  sessionId: number,
  style: string,
  sceneDescription: string
) => {
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: { images: { orderBy: { createdAt: 'desc' } } }
  });

  if (!student || student.sessionId !== sessionId) {
    throw new Error('学生信息不匹配');
  }

  await prisma.student.update({
    where: { studentId },
    data: { lastActivityAt: new Date() }
  });

  const latestImage = student.images[0];
  const editCount = latestImage ? latestImage.editCount + 1 : 0;

  if (latestImage && latestImage.editCount >= 2) {
    throw new Error('编辑次数已用完');
  }

  const model = env.OPENROUTER_IMAGE_MODEL;
  let imageUrl: string | undefined;

  if (shouldUseImagesEndpoint(model)) {
    const prompt = `A ${style} style image depicting: ${sceneDescription}. High quality, detailed, Chinese aesthetic.`;

    const response = await callOpenRouter<OpenRouterImageResponse>('/images', {
      method: 'POST',
      body: JSON.stringify({
        model,
        prompt
      })
    });

    const candidate = response.data?.[0];
    imageUrl = candidate?.url ?? (candidate?.b64_json ? toDataUrl(candidate.b64_json) : undefined);
  } else {
    const payload = {
      model,
      messages: [
        {
          role: 'system',
          content: '你是一名图像创作助手，请根据学生提供的中文描述生成高质量图像。'
        },
        {
          role: 'user',
          content: `请以${style}风格创作图像，场景描述：${sceneDescription}`
        }
      ],
      modalities: ['image']
    };

    const response = await callOpenRouter<OpenRouterChatImageResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    imageUrl = resolveImageFromChatResponse(response);
  }

  if (!imageUrl) {
    throw new Error('图像生成失败');
  }

  const image = await prisma.generatedImage.create({
    data: {
      studentId,
      sessionId,
      style,
      sceneDescription,
      imageUrl,
      editCount
    }
  });

  return image;
};

export const shareImage = async (studentId: number, imageId: number) => {
  const image = await prisma.generatedImage.findUnique({ where: { imageId } });
  if (!image || image.studentId !== studentId) {
    throw new Error('图片不存在或无权分享');
  }

  return prisma.generatedImage.update({
    where: { imageId },
    data: { isShared: true }
  });
};

export const listGalleryImages = (sessionId: number) =>
  prisma.generatedImage.findMany({
    where: { sessionId, isShared: true },
    orderBy: { createdAt: 'desc' },
    include: {
      student: {
        select: { username: true }
      }
    }
  });
