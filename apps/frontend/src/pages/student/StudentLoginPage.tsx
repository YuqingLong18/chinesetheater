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
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await client.post('/student/login', { sessionPin, username, password });
      setStudentAuth(response.data.token, response.data.profile);
      navigate('/student/workspace');
    } catch (err) {
      console.error(err);
      setError('登录失败，请检查信息是否正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="学生登录" subtitle="输入课堂PIN码与账号密码进入学习界面">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <TextInput label="课堂PIN码" placeholder="请输入PIN码" value={sessionPin} onChange={(e) => setSessionPin(e.target.value)} />
        <TextInput label="用户名" placeholder="请输入学生用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <TextInput
          label="密码"
          type="password"
          placeholder="请输入学生密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <GradientButton variant="secondary" className="w-full" type="submit" disabled={loading}>
          {loading ? '登录中...' : '进入课堂'}
        </GradientButton>
      </form>
    </AuthLayout>
  );
};

export default StudentLoginPage;
