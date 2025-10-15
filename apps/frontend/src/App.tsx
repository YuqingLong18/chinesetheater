import { Navigate, Route, Routes } from 'react-router-dom';
import TeacherLoginPage from './pages/teacher/TeacherLoginPage';
import StudentLoginPage from './pages/student/StudentLoginPage';
import TeacherDashboardPage from './pages/teacher/TeacherDashboardPage';
import StudentWorkspacePage from './pages/student/StudentWorkspacePage';
import { useAuthStore } from './store/authStore';

const App = () => {
  const { teacherToken, studentToken } = useAuthStore();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/teacher-login" replace />} />
      <Route path="/teacher-login" element={<TeacherLoginPage />} />
      <Route path="/student-login" element={<StudentLoginPage />} />
      <Route
        path="/teacher/dashboard"
        element={teacherToken ? <TeacherDashboardPage /> : <Navigate to="/teacher-login" replace />}
      />
      <Route
        path="/student/workspace"
        element={studentToken ? <StudentWorkspacePage /> : <Navigate to="/student-login" replace />}
      />
    </Routes>
  );
};

export default App;
