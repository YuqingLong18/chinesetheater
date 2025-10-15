import { prisma } from '../lib/prisma.js';
import { callOpenRouter } from '../lib/openrouter.js';
import { env } from '../config/env.js';

interface OpenRouterImageResponse {
  data: Array<{
    url: string;
  }>;
}

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

  const prompt = `A ${style} style image depicting: ${sceneDescription}. High quality, detailed, Chinese aesthetic.`;

  const response = await callOpenRouter<OpenRouterImageResponse>('/images', {
    method: 'POST',
    body: JSON.stringify({
      model: env.OPENROUTER_IMAGE_MODEL,
      prompt
    })
  });

  const imageUrl = response.data[0]?.url;
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
