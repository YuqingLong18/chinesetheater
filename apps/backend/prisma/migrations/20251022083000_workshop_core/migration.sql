-- CreateEnum
CREATE TYPE "WorkshopMode" AS ENUM ('relay', 'adaptation');
CREATE TYPE "WorkshopStatus" AS ENUM ('active', 'completed', 'archived');
CREATE TYPE "WorkshopMemberRole" AS ENUM ('teacher', 'student');
CREATE TYPE "WorkshopContributionStatus" AS ENUM ('accepted', 'pending', 'retracted');
CREATE TYPE "WorkshopChatType" AS ENUM ('message', 'system');
CREATE TYPE "WorkshopVoteType" AS ENUM ('keep', 'rewrite');
CREATE TYPE "WorkshopBoardType" AS ENUM ('plot', 'imagery', 'dialogue', 'ending', 'notes');
CREATE TYPE "WorkshopSuggestionType" AS ENUM ('structure', 'imagery', 'diction', 'pacing', 'spirit');
CREATE TYPE "WorkshopReactionTargetType" AS ENUM ('contribution', 'board');
CREATE TYPE "WorkshopReactionType" AS ENUM ('like', 'upvote');

-- CreateTable
CREATE TABLE "WorkshopRoom" (
    "roomId" SERIAL PRIMARY KEY,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WorkshopRoom_code_key" ON "WorkshopRoom"("code");

-- CreateTable
CREATE TABLE "WorkshopMember" (
    "memberId" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "role" "WorkshopMemberRole" NOT NULL,
    "studentId" INTEGER,
    "teacherId" INTEGER,
    "nickname" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WorkshopMember_roomId_idx" ON "WorkshopMember"("roomId");

-- CreateTable
CREATE TABLE "WorkshopContribution" (
    "contributionId" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "aiFeedback" JSONB,
    "status" "WorkshopContributionStatus" NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WorkshopContribution_roomId_idx" ON "WorkshopContribution"("roomId");
CREATE INDEX "WorkshopContribution_memberId_idx" ON "WorkshopContribution"("memberId");

-- CreateTable
CREATE TABLE "WorkshopChatMessage" (
    "messageId" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "messageType" "WorkshopChatType" NOT NULL DEFAULT 'message',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WorkshopChatMessage_roomId_idx" ON "WorkshopChatMessage"("roomId");

-- CreateTable
CREATE TABLE "WorkshopContributionVote" (
    "voteId" SERIAL PRIMARY KEY,
    "contributionId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "voteType" "WorkshopVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WorkshopContributionVote_contributionId_memberId_key" ON "WorkshopContributionVote"("contributionId", "memberId");

-- CreateTable
CREATE TABLE "WorkshopBoard" (
    "boardId" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "boardType" "WorkshopBoardType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WorkshopBoard_roomId_boardType_key" ON "WorkshopBoard"("roomId", "boardType");
CREATE INDEX "WorkshopBoard_roomId_idx" ON "WorkshopBoard"("roomId");

-- CreateTable
CREATE TABLE "WorkshopBoardVersion" (
    "versionId" SERIAL PRIMARY KEY,
    "boardId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkshopAiSuggestion" (
    "suggestionId" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "boardId" INTEGER,
    "suggestionType" "WorkshopSuggestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WorkshopAiSuggestion_roomId_idx" ON "WorkshopAiSuggestion"("roomId");
CREATE INDEX "WorkshopAiSuggestion_boardId_idx" ON "WorkshopAiSuggestion"("boardId");

-- CreateTable
CREATE TABLE "WorkshopReaction" (
    "reactionId" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "targetType" "WorkshopReactionTargetType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reactionType" "WorkshopReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributionId" INTEGER,
    "boardId" INTEGER
);

CREATE UNIQUE INDEX "WorkshopReaction_roomId_memberId_targetType_targetId_key" ON "WorkshopReaction"("roomId", "memberId", "targetType", "targetId");
CREATE INDEX "WorkshopReaction_roomId_idx" ON "WorkshopReaction"("roomId");
CREATE INDEX "WorkshopReaction_targetType_targetId_idx" ON "WorkshopReaction"("targetType", "targetId");
CREATE INDEX "WorkshopReaction_contributionId_idx" ON "WorkshopReaction"("contributionId");
CREATE INDEX "WorkshopReaction_boardId_idx" ON "WorkshopReaction"("boardId");

-- Foreign keys
ALTER TABLE "WorkshopRoom"
  ADD CONSTRAINT "WorkshopRoom_creatorTeacherId_fkey" FOREIGN KEY ("creatorTeacherId") REFERENCES "Teacher"("teacherId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopRoom_creatorStudentId_fkey" FOREIGN KEY ("creatorStudentId") REFERENCES "Student"("studentId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopMember"
  ADD CONSTRAINT "WorkshopMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopMember_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("teacherId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopContribution"
  ADD CONSTRAINT "WorkshopContribution_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopContribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopChatMessage"
  ADD CONSTRAINT "WorkshopChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopChatMessage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopContributionVote"
  ADD CONSTRAINT "WorkshopContributionVote_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WorkshopContribution"("contributionId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopContributionVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopBoard"
  ADD CONSTRAINT "WorkshopBoard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopBoardVersion"
  ADD CONSTRAINT "WorkshopBoardVersion_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkshopBoard"("boardId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopBoardVersion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopAiSuggestion"
  ADD CONSTRAINT "WorkshopAiSuggestion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopAiSuggestion_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkshopBoard"("boardId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopReaction"
  ADD CONSTRAINT "WorkshopReaction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WorkshopRoom"("roomId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopReaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkshopMember"("memberId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopReaction_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WorkshopContribution"("contributionId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkshopReaction_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkshopBoard"("boardId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger to keep updatedAt in sync
CREATE OR REPLACE FUNCTION workshoproom_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workshoproom_set_updated_at
BEFORE UPDATE ON "WorkshopRoom"
FOR EACH ROW EXECUTE PROCEDURE workshoproom_set_updated_at();
