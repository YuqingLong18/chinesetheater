import { create } from 'zustand';

interface TeacherState {
  teacherToken: string | null;
  teacherProfile: {
    id: number;
    username: string;
  } | null;
}

interface StudentProfile {
  id: number;
  username: string;
  sessionId: number;
  sessionName: string;
  authorName: string;
  literatureTitle: string;
}

interface StudentState {
  studentToken: string | null;
  studentProfile: StudentProfile | null;
}

interface AuthStore extends TeacherState, StudentState {
  setTeacherAuth: (token: string, profile: TeacherState['teacherProfile']) => void;
  setStudentAuth: (token: string, profile: StudentProfile) => void;
  logoutTeacher: () => void;
  logoutStudent: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  teacherToken: null,
  teacherProfile: null,
  studentToken: null,
  studentProfile: null,
  setTeacherAuth: (token, profile) => set({ teacherToken: token, teacherProfile: profile }),
  setStudentAuth: (token, profile) => set({ studentToken: token, studentProfile: profile }),
  logoutTeacher: () => set({ teacherToken: null, teacherProfile: null }),
  logoutStudent: () => set({ studentToken: null, studentProfile: null })
}));
