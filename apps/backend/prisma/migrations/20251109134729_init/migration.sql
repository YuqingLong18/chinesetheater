-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('student', 'ai');

-- CreateEnum
CREATE TYPE "ImageActionType" AS ENUM ('generation', 'edit');

-- CreateEnum
CREATE TYPE "SpacetimeAnalysisType" AS ENUM ('crossCulture', 'sameEra', 'sameGenre', 'custom');

-- CreateEnum
CREATE TYPE "WorkshopMode" AS ENUM ('relay', 'adaptation');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "WorkshopMemberRole" AS ENUM ('teacher', 'student');

-- CreateEnum
CREATE TYPE "WorkshopContributionStatus" AS ENUM ('accepted', 'pending', 'retracted');

-- CreateEnum
CREATE TYPE "WorkshopChatType" AS ENUM ('message', 'system');

-- CreateEnum
CREATE TYPE "WorkshopVoteType" AS ENUM ('keep', 'rewrite');

-- CreateEnum
CREATE TYPE "WorkshopBoardType" AS ENUM ('plot', 'imagery', 'dialogue', 'ending', 'notes', 'finalDraft');

-- CreateEnum
CREATE TYPE "WorkshopSuggestionType" AS ENUM ('structure', 'imagery', 'diction', 'pacing', 'spirit');

-- CreateEnum
CREATE TYPE "WorkshopReactionTargetType" AS ENUM ('contribution', 'board');

-- CreateEnum
CREATE TYPE "WorkshopReactionType" AS ENUM ('like', 'upvote');

-- CreateEnum
CREATE TYPE "SessionTaskFeature" AS ENUM ('chat', 'writing', 'workshop', 'analysis', 'journey', 'gallery');

-- CreateEnum
CREATE TYPE "SessionTaskSubmissionStatus" AS ENUM ('submitted', 'resubmitted');

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
    "lifeJourney" JSONB,
    "lifeJourneyGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "Student" (
    "studentId" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "initialPassword" TEXT,
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

-- CreateTable
CREATE TABLE "ImageActivity" (
    "activityId" SERIAL NOT NULL,
    "imageId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "actionType" "ImageActionType" NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageActivity_pkey" PRIMARY KEY ("activityId")
);

-- CreateTable
CREATE TABLE "ImageReaction" (
    "reactionId" SERIAL NOT NULL,
    "imageId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageReaction_pkey" PRIMARY KEY ("reactionId")
);

-- CreateTable
CREATE TABLE "ImageComment" (
    "commentId" SERIAL NOT NULL,
    "imageId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageComment_pkey" PRIMARY KEY ("commentId")
);

-- CreateTable
CREATE TABLE "SessionTask" (
    "taskId" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "feature" "SessionTaskFeature" NOT NULL,
    "config" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTask_pkey" PRIMARY KEY ("taskId")
);

-- CreateTable
CREATE TABLE "SessionTaskSubmission" (
    "submissionId" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" "SessionTaskSubmissionStatus" NOT NULL DEFAULT 'submitted',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTaskSubmission_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "SpacetimeAnalysis" (
    "analysisId" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "workTitle" TEXT NOT NULL,
    "era" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "analysisType" "SpacetimeAnalysisType" NOT NULL,
    "focusScope" TEXT,
    "promptNotes" TEXT,
    "customInstruction" TEXT,
    "generatedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpacetimeAnalysis_pkey" PRIMARY KEY ("analysisId")
);

-- CreateTable
CREATE TABLE "WorkshopRoom" (
    "roomId" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "WorkshopMode" NOT NULL,
    "theme" TEXT,
    "originalTitle" TEXT,
    "originalContent" TEXT,
    "meterRequirement" TEXT,
    "maxParticipants" INTEGER NOT NULL,
    "targetLines" INTEGER,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'active',
    "currentTurnOrder" INTEGER,
    "timeLimitMinutes" INTEGER,
    "creatorTeacherId" INTEGER,
    "creatorStudentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopRoom_pkey" PRIMARY KEY ("roomId")
);

-- CreateTable
CREATE TABLE "WorkshopMember" (
    "memberId" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "role" "WorkshopMemberRole" NOT NULL,
    "studentId" INTEGER,
    "teacherId" INTEGER,
    "nickname" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopMember_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "WorkshopContribution" (
    "contributionId" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "aiFeedback" JSONB,
    "status" "WorkshopContributionStatus" NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopContribution_pkey" PRIMARY KEY ("contributionId")
);

-- CreateTable
CREATE TABLE "WorkshopChatMessage" (
    "messageId" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "messageType" "WorkshopChatType" NOT NULL DEFAULT 'message',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopChatMessage_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "WorkshopContributionVote" (
    "voteId" SERIAL NOT NULL,
    "contributionId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "voteType" "WorkshopVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopContributionVote_pkey" PRIMARY KEY ("voteId")
);

-- CreateTable
CREATE TABLE "WorkshopBoard" (
    "boardId" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "boardType" "WorkshopBoardType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopBoard_pkey" PRIMARY KEY ("boardId")
);

-- CreateTable
CREATE TABLE "WorkshopBoardVersion" (
    "versionId" SERIAL NOT NULL,
    "boardId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopBoardVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "WorkshopAiSuggestion" (
    "suggestionId" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "boardId" INTEGER,
    "suggestionType" "WorkshopSuggestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopAiSuggestion_pkey" PRIMARY KEY ("suggestionId")
);

-- CreateTable
CREATE TABLE "WorkshopReaction" (
    "reactionId" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "targetType" "WorkshopReactionTargetType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reactionType" "WorkshopReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributionId" INTEGER,
    "boardId" INTEGER,

    CONSTRAINT "WorkshopReaction_pkey" PRIMARY KEY ("reactionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_username_key" ON "Teacher"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionPin_key" ON "Session"("sessionPin");

-- CreateIndex
CREATE UNIQUE INDEX "Student_sessionId_username_key" ON "Student"("sessionId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_studentId_sessionId_key" ON "Conversation"("studentId", "sessionId");

-- CreateIndex
CREATE INDEX "ImageReaction_sessionId_idx" ON "ImageReaction"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageReaction_imageId_studentId_key" ON "ImageReaction"("imageId", "studentId");

-- CreateIndex
CREATE INDEX "ImageComment_imageId_idx" ON "ImageComment"("imageId");

-- CreateIndex
CREATE INDEX "ImageComment_sessionId_idx" ON "ImageComment"("sessionId");

-- CreateIndex
CREATE INDEX "SessionTask_sessionId_orderIndex_idx" ON "SessionTask"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "SessionTaskSubmission_studentId_idx" ON "SessionTaskSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTaskSubmission_taskId_studentId_key" ON "SessionTaskSubmission"("taskId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopRoom_code_key" ON "WorkshopRoom"("code");

-- CreateIndex
CREATE INDEX "WorkshopMember_roomId_idx" ON "WorkshopMember"("roomId");

-- CreateIndex
CREATE INDEX "WorkshopContribution_roomId_idx" ON "WorkshopContribution"("roomId");

-- CreateIndex
CREATE INDEX "WorkshopContribution_memberId_idx" ON "WorkshopContribution"("memberId");

-- CreateIndex
CREATE INDEX "WorkshopChatMessage_roomId_idx" ON "WorkshopChatMessage"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopContributionVote_contributionId_memberId_key" ON "WorkshopContributionVote"("contributionId", "memberId");

-- CreateIndex
CREATE INDEX "WorkshopBoard_roomId_idx" ON "WorkshopBoard"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopBoard_roomId_boardType_key" ON "WorkshopBoard"("roomId", "boardType");

-- CreateIndex
CREATE INDEX "WorkshopAiSuggestion_roomId_idx" ON "WorkshopAiSuggestion"("roomId");

-- CreateIndex
CREATE INDEX "WorkshopAiSuggestion_boardId_idx" ON "WorkshopAiSuggestion"("boardId");

-- CreateIndex
CREATE INDEX "WorkshopReaction_roomId_idx" ON "WorkshopReaction"("roomId");

-- CreateIndex
CREATE INDEX "WorkshopReaction_targetType_targetId_idx" ON "WorkshopReaction"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopReaction_roomId_memberId_targetType_targetId_key" ON "WorkshopReaction"("roomId", "memberId", "targetType", "targetId");

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

-- AddForeignKey
ALTER TABLE "ImageActivity" ADD CONSTRAINT "ImageActivity_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("imageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageActivity" ADD CONSTRAINT "ImageActivity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageActivity" ADD CONSTRAINT "ImageActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageReaction" ADD CONSTRAINT "ImageReaction_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("imageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageReaction" ADD CONSTRAINT "ImageReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageReaction" ADD CONSTRAINT "ImageReaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageComment" ADD CONSTRAINT "ImageComment_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("imageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageComment" ADD CONSTRAINT "ImageComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageComment" ADD CONSTRAINT "ImageComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTask" ADD CONSTRAINT "SessionTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTaskSubmission" ADD CONSTRAINT "SessionTaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SessionTask"("taskId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTaskSubmission" ADD CONSTRAINT "SessionTaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacetimeAnalysis" ADD CONSTRAINT "SpacetimeAnalysis_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacetimeAnalysis" ADD CONSTRAINT "SpacetimeAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopMember" ADD CONSTRAINT "WorkshopMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopContribution" ADD CONSTRAINT "WorkshopContribution_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopContribution" ADD CONSTRAINT "WorkshopContribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopChatMessage" ADD CONSTRAINT "WorkshopChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopChatMessage" ADD CONSTRAINT "WorkshopChatMessage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopContributionVote" ADD CONSTRAINT "WorkshopContributionVote_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WorkshopContribution"("contributionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopContributionVote" ADD CONSTRAINT "WorkshopContributionVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBoard" ADD CONSTRAINT "WorkshopBoard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBoardVersion" ADD CONSTRAINT "WorkshopBoardVersion_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkshopBoard"("boardId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBoardVersion" ADD CONSTRAINT "WorkshopBoardVersion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopAiSuggestion" ADD CONSTRAINT "WorkshopAiSuggestion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopAiSuggestion" ADD CONSTRAINT "WorkshopAiSuggestion_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkshopBoard"("boardId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopReaction" ADD CONSTRAINT "WorkshopReaction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopReaction" ADD CONSTRAINT "WorkshopReaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopReaction" ADD CONSTRAINT "WorkshopReaction_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WorkshopContribution"("contributionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopReaction" ADD CONSTRAINT "WorkshopReaction_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkshopBoard"("boardId") ON DELETE CASCADE ON UPDATE CASCADE;
