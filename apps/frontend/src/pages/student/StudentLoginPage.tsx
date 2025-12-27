import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import TextInput from '../../components/TextInput';
import GradientButton from '../../components/GradientButton';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const StudentLoginPage = () => {
  const navigate = useNavigate();
  const setStudentAuth = useAuthStore((state) => state.setStudentAuth);

  const [sessionPin, setSessionPin] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await client.post('/student/login', { sessionPin, username });
      setStudentAuth(response.data.token, response.data.profile);
      navigate('/student/workspace');
    } catch (err) {
      console.error(err);
      setError('登录失败，请检查PIN码或稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="学生登录" subtitle="输入课堂PIN码与您的昵称进入学习界面">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <TextInput label="课堂PIN码" placeholder="请输入6位PIN码" value={sessionPin} onChange={(e) => setSessionPin(e.target.value)} />
        <TextInput label="昵称" placeholder="请输入您的昵称" value={username} onChange={(e) => setUsername(e.target.value)} />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <GradientButton variant="secondary" className="w-full" type="submit" disabled={loading}>
          {loading ? '登录中...' : '进入课堂'}
        </GradientButton>
      </form>
    </AuthLayout>
  );
};

export default StudentLoginPage;
