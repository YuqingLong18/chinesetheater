import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import TextInput from '../../components/TextInput';
import GradientButton from '../../components/GradientButton';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const TeacherLoginPage = () => {
  const navigate = useNavigate();
  const setTeacherAuth = useAuthStore((state) => state.setTeacherAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await client.post('/teacher/login', { username, password });
      setTeacherAuth(response.data.token, response.data.teacher);
      navigate('/teacher/dashboard');
    } catch (err) {
      console.error(err);
      setError('登录失败，请检查用户名或密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="教师登录" subtitle="输入账号密码进入教师控制面板">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <TextInput label="用户名" placeholder="请输入用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <TextInput
          label="密码"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <GradientButton variant="primary" className="w-full" type="submit" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </GradientButton>
      </form>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <GradientButton variant="secondary" className="w-full" onClick={() => navigate('/student-login')}>
          我是学生
        </GradientButton>
      </div>
    </AuthLayout>
  );
};

export default TeacherLoginPage;
