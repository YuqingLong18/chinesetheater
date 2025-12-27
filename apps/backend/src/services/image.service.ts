import { Buffer } from 'node:buffer';
import { prisma } from '../lib/prisma.js';
import { callVolcengineImage, callVolcengineChat, moderateContent } from '../lib/volcengine.js';
import { env } from '../config/env.js';

const toDataUrl = (base64: string, mime = 'image/png') =>
  base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;

const resolveImageFromChatResponse = (response: any): string => {
  const visited = new Set<unknown>();
  const queue: unknown[] = [];

  if (response.choices) {
    queue.push(response.choices);
  }

  const isDataLike = (value: string) =>
    value.startsWith('data:') || /^[A-Za-z0-9+/=\r\n]+$/.test(value.trim());

  const tryExtractFromObject = (item: Record<string, unknown>): string | null => {
    const directUrlCandidates = [
      item.image_url,
      (item.image_url as { url?: string })?.url,
      item.url,
      item.imageUrl,
      item.href
    ].filter((value): value is string => typeof value === 'string');

    for (const candidate of directUrlCandidates) {
      if (candidate.startsWith('http') || candidate.startsWith('data:')) {
        return candidate;
      }
    }

    const base64Sources: Array<string | undefined> = [
      typeof item.image_base64 === 'string' ? item.image_base64 : undefined,
      typeof item.b64_json === 'string' ? item.b64_json : undefined,
      typeof item.base64 === 'string' ? item.base64 : undefined,
      typeof (item as { inline_data?: { data?: string } }).inline_data?.data === 'string'
        ? (item as { inline_data?: { data?: string } }).inline_data?.data
        : undefined,
      typeof (item as { text?: string }).text === 'string'
        ? (item as { text?: string }).text
        : undefined,
      typeof item.data === 'string' ? item.data : undefined
    ];

    for (const candidate of base64Sources) {
      if (typeof candidate === 'string' && isDataLike(candidate)) {
        return toDataUrl(candidate);
      }
    }

    return null;
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (typeof current === 'string') {
      if (current.startsWith('http') || current.startsWith('data:')) {
        return current;
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === 'object') {
      const objectCandidate = tryExtractFromObject(current as Record<string, unknown>);
      if (objectCandidate) {
        return objectCandidate;
      }

      const values = Object.values(current as Record<string, unknown>);
      if (values.length > 0) {
        queue.push(...values);
      }
    }
  }

  throw new Error('图像生成失败：响应中缺少图像数据');
};

const fetchImageAsDataUrl = async (imageUrl: string) => {
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('原始图像加载失败');
  }

  const contentType = response.headers.get('content-type') ?? 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return toDataUrl(buffer.toString('base64'), contentType);
};

const buildEditMessages = (
  style: string,
  baseImage: string,
  editInstruction: string,
  sceneDescription: string
) => [
    {
      role: 'system',
      content: '你是一名图像创作助手，请在保留原画核心风格的基础上进行细节修改。'
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `原始创作风格：${style}。原始场景描述：${sceneDescription}` },
        { type: 'text', text: `编辑指令：${editInstruction}` },
        { type: 'image_url', image_url: { url: baseImage } }
      ]
    }
  ];

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

  // Content Moderation
  const moderation = await moderateContent(`${style} ${sceneDescription}`);
  if (!moderation.allowed) {
    throw new Error('描述包含不当内容，无法生成。');
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

  const response = await callVolcengineImage({
    model: env.VOLCENGINE_IMAGE_MODEL,
    prompt: `以${style}风格创作：${sceneDescription}`,
    size: '2048x2048'
  });

  const imageUrl = response.data?.[0]?.url;

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

  await prisma.imageActivity.create({
    data: {
      imageId: image.imageId,
      studentId,
      sessionId,
      actionType: 'generation',
      instruction: sceneDescription
    }
  });

  return image;
};

export const editGeneratedImage = async (
  studentId: number,
  imageId: number,
  editInstruction: string
) => {
  const image = await prisma.generatedImage.findUnique({ where: { imageId } });
  if (!image || image.studentId !== studentId) {
    throw new Error('图片不存在或无权编辑');
  }

  // Content Moderation
  const moderation = await moderateContent(editInstruction);
  if (!moderation.allowed) {
    throw new Error('编辑指令包含不当内容。');
  }


  if (image.editCount >= 2) {
    throw new Error('编辑次数已用完');
  }

  const baseImage = await fetchImageAsDataUrl(image.imageUrl);
  const previousState = {
    imageUrl: image.imageUrl,
    style: image.style,
    sceneDescription: image.sceneDescription,
    editCount: image.editCount
  };

  const response = await callVolcengineChat({
    model: env.VOLCENGINE_CHAT_MODEL,
    messages: buildEditMessages(image.style, baseImage, editInstruction, image.sceneDescription) as any
  });

  const updatedImageUrl = resolveImageFromChatResponse(response);

  const updatedImage = await prisma.generatedImage.update({
    where: { imageId },
    data: {
      imageUrl: updatedImageUrl,
      editCount: { increment: 1 },
      sceneDescription: `${image.sceneDescription}
编辑指令：${editInstruction}`
    }
  });

  await prisma.imageActivity.create({
    data: {
      imageId,
      studentId,
      sessionId: image.sessionId,
      actionType: 'edit',
      instruction: editInstruction
    }
  });

  return {
    updatedImage,
    previousImage: previousState
  };
};

interface ImageVersion {
  imageUrl: string;
  style: string;
  sceneDescription: string;
  editCount: number;
}

export const revertImageEdit = async (
  studentId: number,
  imageId: number,
  previous: ImageVersion,
  currentImageUrl: string
) => {
  const image = await prisma.generatedImage.findUnique({ where: { imageId } });
  if (!image || image.studentId !== studentId) {
    throw new Error('图片不存在或无权编辑');
  }

  if (image.imageUrl !== currentImageUrl) {
    throw new Error('当前图像已更新，请刷新后重试');
  }

  if (image.editCount <= 0) {
    throw new Error('暂无可撤销的编辑');
  }

  const revertedImage = await prisma.generatedImage.update({
    where: { imageId },
    data: {
      imageUrl: previous.imageUrl,
      style: previous.style,
      sceneDescription: previous.sceneDescription,
      editCount: previous.editCount
    }
  });

  await prisma.imageActivity.create({
    data: {
      imageId,
      studentId,
      sessionId: image.sessionId,
      actionType: 'edit',
      instruction: '撤销编辑'
    }
  });

  return revertedImage;
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

export const listGalleryImages = async (sessionId: number, studentId: number) => {
  const images = await prisma.generatedImage.findMany({
    where: { sessionId, isShared: true },
    orderBy: { createdAt: 'desc' },
    include: {
      student: {
        select: { username: true }
      },
      reactions: {
        where: { studentId },
        select: { reactionId: true }
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: {
          student: {
            select: {
              username: true
            }
          }
        }
      },
      _count: {
        select: {
          reactions: true,
          comments: true
        }
      }
    }
  });

  return images.map((image) => ({
    imageId: image.imageId,
    imageUrl: image.imageUrl,
    style: image.style,
    sceneDescription: image.sceneDescription,
    username: image.student.username,
    createdAt: image.createdAt,
    likeCount: image._count.reactions,
    likedByMe: image.reactions.length > 0,
    commentCount: image._count.comments,
    recentComments: image.comments
      .map((comment) => ({
        commentId: comment.commentId,
        content: comment.content,
        username: comment.student.username,
        createdAt: comment.createdAt
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }));
};

export const toggleImageLike = async (sessionId: number, studentId: number, imageId: number) => {
  const image = await prisma.generatedImage.findUnique({ where: { imageId } });
  if (!image || image.sessionId !== sessionId || !image.isShared) {
    throw new Error('作品不存在或未分享到画廊');
  }

  const existing = await prisma.imageReaction.findUnique({
    where: {
      imageId_studentId: {
        imageId,
        studentId
      }
    }
  });

  let liked = false;
  if (existing) {
    await prisma.imageReaction.delete({ where: { reactionId: existing.reactionId } });
  } else {
    await prisma.imageReaction.create({
      data: {
        imageId,
        studentId,
        sessionId
      }
    });
    liked = true;
  }

  const likeCount = await prisma.imageReaction.count({ where: { imageId } });
  return { liked, likeCount };
};

export const addImageComment = async (sessionId: number, studentId: number, imageId: number, content: string) => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('评论不能为空');
  }
  if (trimmed.length > 500) {
    throw new Error('评论内容过长');
  }

  const image = await prisma.generatedImage.findUnique({ where: { imageId } });
  if (!image || image.sessionId !== sessionId || !image.isShared) {
    throw new Error('作品不存在或未分享到画廊');
  }

  const comment = await prisma.imageComment.create({
    data: {
      imageId,
      studentId,
      sessionId,
      content: trimmed
    },
    include: {
      student: {
        select: { username: true }
      }
    }
  });

  const commentCount = await prisma.imageComment.count({ where: { imageId } });

  return {
    comment: {
      commentId: comment.commentId,
      content: comment.content,
      createdAt: comment.createdAt,
      username: comment.student.username
    },
    commentCount
  };
};

export const listImageComments = async (sessionId: number, imageId: number) => {
  const image = await prisma.generatedImage.findUnique({ where: { imageId } });
  if (!image || image.sessionId !== sessionId || !image.isShared) {
    throw new Error('作品不存在或未分享到画廊');
  }

  const comments = await prisma.imageComment.findMany({
    where: { imageId },
    orderBy: { createdAt: 'asc' },
    include: {
      student: {
        select: { username: true }
      }
    }
  });

  return comments.map((comment) => ({
    commentId: comment.commentId,
    content: comment.content,
    createdAt: comment.createdAt,
    username: comment.student.username
  }));
};
