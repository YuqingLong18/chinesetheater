-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('student', 'ai');

-- CreateTable
CREATE TABLE "Teacher" (
    "teacherId" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("teacherId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionId" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "sessionName" TEXT NOT NULL,
    "sessionPin" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "literatureTitle" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "Student" (
    "studentId" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "firstLoginAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "conversationId" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("conversationId")
);

-- CreateTable
CREATE TABLE "Message" (
    "messageId" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "studentId" INTEGER,
    "senderType" "SenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "imageId" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "sceneDescription" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("imageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_username_key" ON "Teacher"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionPin_key" ON "Session"("sessionPin");

-- CreateIndex
CREATE UNIQUE INDEX "Student_sessionId_username_key" ON "Student"("sessionId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_studentId_sessionId_key" ON "Conversation"("studentId", "sessionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("teacherId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
