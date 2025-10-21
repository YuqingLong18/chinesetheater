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
