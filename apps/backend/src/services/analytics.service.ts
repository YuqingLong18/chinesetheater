import { prisma } from '../lib/prisma.js';

export const getSessionAnalytics = async (sessionId: number) => {
  const [students, conversations, images] = await Promise.all([
    prisma.student.findMany({
      where: { sessionId },
      orderBy: { studentId: 'asc' }
    }),
    prisma.conversation.findMany({
      where: { sessionId },
      include: {
        student: {
          select: { username: true }
        }
      }
    }),
    prisma.generatedImage.findMany({
      where: { sessionId },
      include: {
        student: {
          select: { username: true }
        }
      }
    })
  ]);

  return {
    onlineStudents: students
      .filter((student) => student.lastActivityAt && Date.now() - student.lastActivityAt.getTime() < 10 * 60 * 1000)
      .map((student) => ({
        username: student.username,
        lastActivityAt: student.lastActivityAt,
        firstLoginAt: student.firstLoginAt
      })),
    conversationStats: conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      username: conversation.student.username,
      messageCount: conversation.messageCount,
      totalDuration: conversation.totalDuration,
      updatedAt: conversation.updatedAt
    })),
    imageStats: images.map((image) => ({
      imageId: image.imageId,
      username: image.student.username,
      isShared: image.isShared,
      editCount: image.editCount,
      createdAt: image.createdAt
    })),
    galleryPreview: images
      .filter((image) => image.isShared)
      .slice(0, 12)
      .map((image) => ({
        imageId: image.imageId,
        username: image.student.username,
        imageUrl: image.imageUrl,
        style: image.style,
        sceneDescription: image.sceneDescription
      }))
  };
};
