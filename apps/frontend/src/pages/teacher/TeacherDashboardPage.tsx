import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import TextInput from '../../components/TextInput';
import GradientButton from '../../components/GradientButton';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { TeacherSession, StudentCredential } from '../../types';

interface StudentRow {
  studentId: number;
  username: string;
  isUsed: boolean;
  firstLoginAt: string | null;
  lastActivityAt: string | null;
}

interface AnalyticsResponse {
  onlineStudents: Array<{
    username: string;
    lastActivityAt: string | null;
    firstLoginAt: string | null;
  }>;
  conversationStats: Array<{
    conversationId: number;
    username: string;
    messageCount: number;
    totalDuration: number;
    updatedAt: string;
  }>;
  imageStats: Array<{
    imageId: number;
    username: string;
    isShared: boolean;
    editCount: number;
    createdAt: string;
  }>;
  galleryPreview: Array<{
    imageId: number;
    username: string;
    imageUrl: string;
    style: string;
    sceneDescription: string;
  }>;
}

const TeacherDashboardPage = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logoutTeacher);
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [credentials, setCredentials] = useState<StudentCredential[]>([]);
  const [formData, setFormData] = useState({
    sessionName: '',
    sessionPin: '',
    authorName: '',
    literatureTitle: ''
  });
  const [quantity, setQuantity] = useState(5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const response = await client.get('/teacher/sessions');
      setSessions(response.data.sessions ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStudents = async (sessionId: number) => {
    try {
      const response = await client.get(`/teacher/sessions/${sessionId}/students`);
      setStudents(response.data.students ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAnalytics = async (sessionId: number) => {
    try {
      const response = await client.get(`/teacher/sessions/${sessionId}/analytics`);
      setAnalytics(response.data.analytics ?? null);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchStudents(selectedSession);
      fetchAnalytics(selectedSession);
    }
  }, [selectedSession]);

  const handleCreateSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await client.post('/teacher/sessions', formData);
      setFormData({ sessionName: '', sessionPin: '', authorName: '', literatureTitle: '' });
      setMessage('课堂会话创建成功');
      fetchSessions();
    } catch (error) {
      console.error(error);
      setMessage('创建失败，请检查信息是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStudents = async () => {
    if (!selectedSession) {
      setMessage('请先选择课堂会话');
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      const response = await client.post(`/teacher/sessions/${selectedSession}/students`, { quantity });
      setCredentials(response.data.credentials ?? []);
      fetchStudents(selectedSession);
      setMessage('学生账号生成完成');
    } catch (error) {
      console.error(error);
      setMessage('生成账号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/teacher-login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">教师控制面板</h1>
          <p className="text-sm text-gray-500">管理课堂会话、学生账号与课堂活动</p>
        </div>
        <GradientButton variant="secondary" onClick={handleLogout}>
          退出登录
        </GradientButton>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">创建新课堂会话</h2>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSession}>
              <TextInput
                label="会话名称"
                placeholder="例如：唐诗鉴赏课"
                value={formData.sessionName}
                onChange={(e) => setFormData((prev) => ({ ...prev, sessionName: e.target.value }))}
              />
              <TextInput
                label="课堂PIN码"
                placeholder="4-6位数字"
                value={formData.sessionPin}
                onChange={(e) => setFormData((prev) => ({ ...prev, sessionPin: e.target.value }))}
              />
              <TextInput
                label="作者姓名"
                placeholder="请输入作者"
                value={formData.authorName}
                onChange={(e) => setFormData((prev) => ({ ...prev, authorName: e.target.value }))}
              />
              <TextInput
                label="文学作品名称"
                placeholder="请输入作品名称"
                value={formData.literatureTitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, literatureTitle: e.target.value }))}
              />
              <GradientButton variant="primary" className="md:col-span-2" type="submit" disabled={loading}>
                {loading ? '提交中...' : '创建会话'}
              </GradientButton>
            </form>
            {message ? <p className="text-sm text-blue-600">{message}</p> : null}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">课堂列表</h2>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2"
                value={selectedSession ?? ''}
                onChange={(e) => setSelectedSession(Number(e.target.value) || null)}
              >
                <option value="">选择课堂会话</option>
                {sessions.map((session) => (
                  <option key={session.sessionId} value={session.sessionId}>
                    {session.sessionName}（PIN: {session.sessionPin}）
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-2">序号</th>
                    <th className="px-4 py-2">用户名</th>
                    <th className="px-4 py-2">状态</th>
                    <th className="px-4 py-2">首次登录</th>
                    <th className="px-4 py-2">最近活动</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student, index) => (
                    <tr key={student.studentId}>
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2 font-medium">{student.username}</td>
                      <td className="px-4 py-2">{student.isUsed ? '已登录' : '未使用'}</td>
                      <td className="px-4 py-2">{student.firstLoginAt ? new Date(student.firstLoginAt).toLocaleString('zh-CN') : '-'}</td>
                      <td className="px-4 py-2">{student.lastActivityAt ? new Date(student.lastActivityAt).toLocaleString('zh-CN') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">学生账号生成器</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between text-sm text-gray-600">
                <span>生成数量（1-50）</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-24 rounded-lg border border-gray-200 px-3 py-2"
                />
              </label>
              <GradientButton onClick={handleGenerateStudents} disabled={loading}>
                {loading ? '生成中...' : '生成账号'}
              </GradientButton>
              {credentials.length > 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">生成结果（请妥善保存）</p>
                  <div className="mt-2 space-y-2 text-sm font-mono">
                    {credentials.map((item, index) => (
                      <div key={`${item.username}-${index}`} className="flex items-center justify-between">
                        <span>{index + 1}. 用户名：{item.username}</span>
                        <span>密码：{item.password}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">课堂活动监控</h2>
            {analytics ? (
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-800">在线学生</h3>
                  <ul className="mt-2 space-y-1">
                    {analytics.onlineStudents.length === 0 ? <li>暂无学生在线</li> : null}
                    {analytics.onlineStudents.map((student) => (
                      <li key={student.username} className="flex justify-between">
                        <span>{student.username}</span>
                        <span className="text-gray-500">
                          {student.lastActivityAt ? new Date(student.lastActivityAt).toLocaleTimeString('zh-CN') : '-'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800">对话统计</h3>
                  <ul className="mt-2 space-y-1">
                    {analytics.conversationStats.map((item) => (
                      <li key={item.conversationId} className="flex justify-between">
                        <span>{item.username}</span>
                        <span className="text-gray-500">轮数：{item.messageCount}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800">图像生成</h3>
                  <ul className="mt-2 space-y-1">
                    {analytics.imageStats.map((item) => (
                      <li key={item.imageId} className="flex justify-between">
                        <span>{item.username}</span>
                        <span className="text-gray-500">编辑次数：{item.editCount}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800">课堂画廊预览</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {analytics.galleryPreview.map((image) => (
                      <div key={image.imageId} className="overflow-hidden rounded-lg border border-gray-200">
                        <img src={image.imageUrl} alt={image.sceneDescription} className="h-20 w-full object-cover" />
                        <div className="px-2 py-1 text-xs text-gray-600">
                          <p>{image.username}</p>
                          <p className="truncate">{image.style}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">选择课堂后查看实时数据</p>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
};

export default TeacherDashboardPage;
