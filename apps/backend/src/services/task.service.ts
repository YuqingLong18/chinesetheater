import { Prisma, SessionTaskFeature, SessionTaskSubmissionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateSessionTaskInput {
  title: string;
  description?: string | null;
  feature: SessionTaskFeature;
  isRequired?: boolean;
  config?: Prisma.InputJsonValue;
  orderIndex?: number;
}

type TaskClient = Pick<typeof prisma, 'sessionTask'>;

export const createSessionTasks = async (
  sessionId: number,
  tasks: CreateSessionTaskInput[],
  client: TaskClient = prisma
) => {
  if (!tasks || tasks.length === 0) {
    return;
  }

  await client.sessionTask.createMany({
    data: tasks.map((task, index) => ({
      sessionId,
      title: task.title,
      description: task.description ?? null,
      feature: task.feature,
      config: (task.config as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      isRequired: task.isRequired ?? true,
      orderIndex: task.orderIndex ?? index
    }))
  });
};

export const listTasksForStudent = async (sessionId: number, studentId: number) => {
  const tasks = await prisma.sessionTask.findMany({
    where: { sessionId },
    orderBy: { orderIndex: 'asc' },
    include: {
      submissions: {
        where: { studentId },
        take: 1
      }
    }
  });

  return tasks.map((task) => ({
    taskId: task.taskId,
    title: task.title,
    description: task.description,
    feature: task.feature,
    isRequired: task.isRequired,
    orderIndex: task.orderIndex,
    config: task.config,
    submission: task.submissions[0]
      ? {
          submissionId: task.submissions[0].submissionId,
          status: task.submissions[0].status,
          payload: task.submissions[0].payload,
          createdAt: task.submissions[0].createdAt,
          updatedAt: task.submissions[0].updatedAt
        }
      : null
  }));
};

export const submitTaskForStudent = async (
  taskId: number,
  studentId: number,
  sessionId: number,
  payload: Prisma.InputJsonValue
) => {
  const task = await prisma.sessionTask.findUnique({ where: { taskId } });
  if (!task || task.sessionId !== sessionId) {
    throw new Error('任务不存在或已失效');
  }

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student || student.sessionId !== sessionId) {
    throw new Error('学生信息不存在');
  }

  const existing = await prisma.sessionTaskSubmission.findUnique({
    where: {
      taskId_studentId: {
        taskId,
        studentId
      }
    }
  });

  const nextStatus: SessionTaskSubmissionStatus = existing ? 'resubmitted' : 'submitted';

  const submission = await prisma.sessionTaskSubmission.upsert({
    where: {
      taskId_studentId: {
        taskId,
        studentId
      }
    },
    update: {
      payload,
      status: nextStatus
    },
    create: {
      taskId,
      studentId,
      payload,
      status: nextStatus
    }
  });

  return submission;
};

export const getSessionTaskSummary = async (sessionId: number) => {
  const [tasks, studentCount] = await Promise.all([
    prisma.sessionTask.findMany({
      where: { sessionId },
      orderBy: { orderIndex: 'asc' },
      include: {
        submissions: {
          include: {
            student: {
              select: {
                studentId: true,
                username: true
              }
            }
          }
        }
      }
    }),
    prisma.student.count({ where: { sessionId } })
  ]);

  return {
    studentCount,
    tasks: tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      feature: task.feature,
      isRequired: task.isRequired,
      orderIndex: task.orderIndex,
      config: task.config,
      submissions: task.submissions.map((submission) => ({
        submissionId: submission.submissionId,
        studentId: submission.studentId,
        username: submission.student?.username ?? '学生',
        status: submission.status,
        payload: submission.payload,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt
      })),
      submittedCount: task.submissions.length
    }))
  };
};
