export interface TeacherSession {
  sessionId: number;
  sessionName: string;
  sessionPin: string;
  authorName: string;
  literatureTitle: string;
  createdAt: string;
}

export interface StudentCredential {
  username: string;
  password: string;
}

export interface StudentGalleryItem {
  imageId: number;
  imageUrl: string;
  style: string;
  sceneDescription: string;
  username: string;
  createdAt?: string;
}

export interface SessionActivityMessage {
  messageId: number;
  conversationId: number;
  studentId: number;
  username: string;
  senderType: 'student' | 'ai';
  content: string;
  timestamp: string;
}

export interface SessionActivityImage {
  activityId: number;
  imageId: number;
  studentId: number;
  username: string;
  actionType: 'generation' | 'edit';
  instruction: string;
  createdAt: string;
  imageUrl: string;
  style: string;
  sceneDescription: string;
}

export interface SessionActivityFeed {
  messages: SessionActivityMessage[];
  images: SessionActivityImage[];
  spacetimeAnalyses: SessionActivitySpacetime[];
}

export type SpacetimeAnalysisType = 'crossCulture' | 'sameEra' | 'sameGenre' | 'custom';

export interface StudentSpacetimeAnalysis {
  analysisId: number;
  author: string;
  workTitle: string;
  era: string;
  genre: string;
  analysisType: SpacetimeAnalysisType;
  focusScope?: string | null;
  promptNotes?: string | null;
  customInstruction?: string | null;
  generatedContent: string;
  createdAt: string;
}

export interface SessionActivitySpacetime extends StudentSpacetimeAnalysis {
  studentId: number;
  username: string;
}

export interface LifeJourneyGeography {
  terrain: string;
  vegetation: string;
  water: string;
  climate: string;
}

export interface LifeJourneyPoem {
  title: string;
  content: string;
}

export interface LifeJourneyLocation {
  id: number;
  name: string;
  modernName?: string | null;
  latitude: number;
  longitude: number;
  period: string;
  description: string;
  events: string[];
  geography: LifeJourneyGeography;
  poems: LifeJourneyPoem[];
}

export interface LifeJourneyResponse {
  heroName: string;
  summary: string;
  locations: LifeJourneyLocation[];
  highlights?: string[];
  routeNotes?: string | null;
}

export type WorkshopMode = 'relay' | 'adaptation';
export type WorkshopStatus = 'active' | 'completed' | 'archived';
export type WorkshopContributionStatus = 'accepted' | 'pending' | 'retracted';
export type WorkshopVoteType = 'keep' | 'rewrite';

export interface WorkshopMember {
  memberId: number;
  roomId: number;
  role: 'teacher' | 'student';
  studentId?: number | null;
  teacherId?: number | null;
  nickname: string;
  orderIndex: number;
  isActive: boolean;
  joinedAt: string;
}

export interface WorkshopContribution {
  contributionId: number;
  roomId: number;
  memberId: number;
  orderIndex: number;
  content: string;
  aiFeedback?: unknown;
  status: WorkshopContributionStatus;
  createdAt: string;
  member: WorkshopMember;
  votes: WorkshopVote[];
  reactions: WorkshopReaction[];
}

export interface WorkshopVote {
  voteId: number;
  contributionId: number;
  memberId: number;
  voteType: WorkshopVoteType;
  createdAt: string;
}

export interface WorkshopChatMessage {
  messageId: number;
  roomId: number;
  memberId?: number | null;
  messageType: 'message' | 'system';
  content: string;
  createdAt: string;
  member?: WorkshopMember | null;
}

export interface WorkshopBoardVersion {
  versionId: number;
  boardId: number;
  memberId?: number | null;
  summary?: string | null;
  content: string;
  createdAt: string;
  member?: WorkshopMember | null;
}

export interface WorkshopBoard {
  boardId: number;
  roomId: number;
  boardType: WorkshopBoardType;
  title: string;
  content: string;
  updatedAt: string;
  versions: WorkshopBoardVersion[];
  reactions: WorkshopReaction[];
}

export interface WorkshopAiSuggestion {
  suggestionId: number;
  roomId: number;
  boardId?: number | null;
  suggestionType: WorkshopSuggestionType;
  content: string;
  createdAt: string;
}

export interface WorkshopReaction {
  reactionId: number;
  roomId: number;
  memberId: number;
  targetType: WorkshopReactionTargetType;
  targetId: number;
  reactionType: WorkshopReactionType;
  createdAt: string;
}

export interface WorkshopRoomSummary {
  roomId: number;
  code: string;
  title: string;
  mode: WorkshopMode;
  theme?: string | null;
  meterRequirement?: string | null;
  status: WorkshopStatus;
  currentTurnOrder?: number | null;
  maxParticipants: number;
  targetLines?: number | null;
  members: WorkshopMember[];
  contributions?: WorkshopContribution[];
  chats?: WorkshopChatMessage[];
  boards?: WorkshopBoard[];
  suggestions?: WorkshopAiSuggestion[];
  reactions?: WorkshopReaction[];
  originalTitle?: string | null;
  originalContent?: string | null;
  createdAt: string;
  updatedAt: string;
}
