import { prisma } from '../lib/prisma.js';
import { getSpacetimeAnalytics, listSessionSpacetimeAnalyses } from './spacetime.service.js';

export const getSessionAnalytics = async (sessionId: number) => {
  const [students, conversations, images, spacetime] = await Promise.all([
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
    }),
    getSpacetimeAnalytics(sessionId)
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
      })),
    spacetimeSummary: spacetime
  };
};

export const getSessionActivityFeed = async (sessionId: number) => {
  const [messages, imageActivities, spacetime] = await Promise.all([
    prisma.message.findMany({
      where: { conversation: { sessionId } },
      orderBy: { timestamp: 'desc' },
      include: {
        conversation: {
          select: {
            conversationId: true,
            student: { select: { username: true, studentId: true } }
          }
        }
      }
    }),
    prisma.imageActivity.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { username: true, studentId: true } },
        image: { select: { imageUrl: true, style: true, sceneDescription: true } }
      }
    }),
    listSessionSpacetimeAnalyses(sessionId)
  ]);

  return {
    messages: messages.map((message) => ({
      messageId: message.messageId,
      conversationId: message.conversation.conversationId,
      studentId: message.conversation.student.studentId,
      username: message.conversation.student.username,
      senderType: message.senderType,
      content: message.content,
      timestamp: message.timestamp
    })),
    images: imageActivities.map((activity) => ({
      activityId: activity.activityId,
      imageId: activity.imageId,
      studentId: activity.studentId,
      username: activity.student.username,
      actionType: activity.actionType,
      instruction: activity.instruction,
      createdAt: activity.createdAt,
      imageUrl: activity.image.imageUrl,
      style: activity.image.style,
      sceneDescription: activity.image.sceneDescription
    })),
    spacetimeAnalyses: spacetime.map((analysis) => ({
      analysisId: analysis.analysisId,
      studentId: analysis.student.studentId,
      username: analysis.student.username,
      analysisType: analysis.analysisType,
      author: analysis.author,
      workTitle: analysis.workTitle,
      era: analysis.era,
      genre: analysis.genre,
      focusScope: analysis.focusScope,
      promptNotes: analysis.promptNotes,
      customInstruction: analysis.customInstruction,
      generatedContent: analysis.generatedContent,
      createdAt: analysis.createdAt
    }))
  };
};
