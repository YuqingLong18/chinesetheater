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
