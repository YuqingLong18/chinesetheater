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
}
