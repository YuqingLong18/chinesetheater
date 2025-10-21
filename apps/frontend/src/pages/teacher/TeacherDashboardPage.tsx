import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import TextInput from '../../components/TextInput';
import GradientButton from '../../components/GradientButton';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type {
  TeacherSession,
  StudentCredential,
  SessionActivityFeed,
  SessionActivityMessage,
  SpacetimeAnalysisType
} from '../../types';

interface StudentRow {
  studentId: number;
  username: string;
  initialPassword: string | null;
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
  spacetimeSummary: {
    counts: Record<SpacetimeAnalysisType, number>;
    recent: Array<{
      analysisId: number;
      username: string;
      analysisType: SpacetimeAnalysisType;
      createdAt: string;
    }>;
};
}

const spacetimeTypeLabels: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '中外文学对比',
  sameEra: '同代作者梳理',
  sameGenre: '同流派前后对比'
};

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
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityFeed, setActivityFeed] = useState<SessionActivityFeed | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | number>('all');
  const [activityError, setActivityError] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set<number>());

  const currentSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSession) || null,
    [sessions, selectedSession]
  );

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

  useEffect(() => {
    if (!activityModalOpen || !selectedSession) {
      return undefined;
    }

    let cancelled = false;

    const loadActivity = async (showSpinner: boolean) => {
      if (showSpinner) {
        setActivityLoading(true);
      }
      try {
        const response = await client.get(`/teacher/sessions/${selectedSession}/activity`);
        if (!cancelled) {
          setActivityFeed(response.data.activity ?? { messages: [], images: [], spacetimeAnalyses: [] });
          setActivityError(null);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setActivityError('课堂详情加载失败');
        }
      } finally {
        if (showSpinner && !cancelled) {
          setActivityLoading(false);
        }
      }
    };

    loadActivity(true);
    const interval = window.setInterval(() => loadActivity(false), 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activityModalOpen, selectedSession]);

  useEffect(() => {
    if (!activityFeed) {
      setExpandedMessages(new Set<number>());
      return;
    }

    setExpandedMessages((prev) => {
      const validIds = new Set(activityFeed.messages.filter((msg) => msg.senderType === 'student').map((msg) => msg.messageId));
      const next = new Set<number>();
      validIds.forEach((id) => {
        if (prev.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [activityFeed]);

  const activityStudentOptions = useMemo(() => {
    const map = new Map<number, string>();
    students.forEach((student) => map.set(student.studentId, student.username));
    if (activityFeed) {
      activityFeed.messages.forEach((message) => map.set(message.studentId, message.username));
      activityFeed.images.forEach((item) => map.set(item.studentId, item.username));
      activityFeed.spacetimeAnalyses.forEach((item) => map.set(item.studentId, item.username));
    }

    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-Hans-CN'))
      .map(([id, name]) => ({ id, name }));
  }, [students, activityFeed]);

  const filteredPrompts = useMemo<Array<SessionActivityMessage & { aiReply?: SessionActivityMessage }>>(() => {
    if (!activityFeed) {
      return [];
    }

    const allMessages = activityFeed.messages;
    const studentMessages = allMessages.filter((message) =>
      message.senderType === 'student' && (activityFilter === 'all' || message.studentId === activityFilter)
    );

    const aiMessagesByConversation = new Map<number, SessionActivityMessage[]>();
    allMessages.forEach((message) => {
      if (message.senderType === 'ai') {
        const existing = aiMessagesByConversation.get(message.conversationId) ?? [];
        existing.push(message);
        aiMessagesByConversation.set(message.conversationId, existing);
      }
    });

    aiMessagesByConversation.forEach((arr) =>
      arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    );

    return studentMessages.map((message) => {
      const candidates = aiMessagesByConversation.get(message.conversationId) ?? [];
      const aiReply = candidates.find(
        (candidate) => new Date(candidate.timestamp).getTime() >= new Date(message.timestamp).getTime()
      );
      return { ...message, aiReply };
    });
  }, [activityFeed, activityFilter]);

  const filteredImages = useMemo(() => {
    if (!activityFeed) {
      return [];
    }
    if (activityFilter === 'all') {
      return activityFeed.images;
    }
    return activityFeed.images.filter((item) => item.studentId === activityFilter);
  }, [activityFeed, activityFilter]);

  const filteredSpacetime = useMemo(() => {
    if (!activityFeed) {
      return [];
    }
    if (activityFilter === 'all') {
      return activityFeed.spacetimeAnalyses;
    }
    return activityFeed.spacetimeAnalyses.filter((item) => item.studentId === activityFilter);
  }, [activityFeed, activityFilter]);

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

  const toggleMessageExpansion = (messageId: number) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
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

  const handleOpenActivityModal = () => {
    if (!selectedSession) {
      setMessage('请先选择课堂会话');
      return;
    }
    setActivityFilter('all');
    setActivityFeed(null);
    setActivityError(null);
    setActivityLoading(false);
    setExpandedMessages(new Set<number>());
    setActivityModalOpen(true);
  };

  const handleCloseActivityModal = () => {
    setActivityModalOpen(false);
    setActivityFilter('all');
    setActivityError(null);
    setActivityFeed(null);
    setActivityLoading(false);
    setExpandedMessages(new Set<number>());
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-gray-900">课堂列表</h2>
              <div className="flex items-center gap-3">
                <GradientButton variant="primary" onClick={handleOpenActivityModal} disabled={!selectedSession}>
                  课堂详情
                </GradientButton>
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
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-2">序号</th>
                    <th className="px-4 py-2">用户名</th>
                    <th className="px-4 py-2">初始密码</th>
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
                      <td className="px-4 py-2 font-mono text-sm">{student.initialPassword ?? '——'}</td>
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

          {students.length > 0 ? (
            <Card className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">课堂账号总览</h3>
              <div className="space-y-2 text-sm font-mono text-gray-600">
                {students.map((student, index) => (
                  <div key={`all-credential-${student.studentId}`} className="flex items-center justify-between">
                    <span>{index + 1}. {student.username}</span>
                    <span>初始密码：{student.initialPassword ?? '——'}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

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
                  <h3 className="font-semibold text-gray-800">构建时空</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5">
                      中外对比：{analytics.spacetimeSummary.counts.crossCulture}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5">
                      同时代：{analytics.spacetimeSummary.counts.sameEra}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5">
                      同流派：{analytics.spacetimeSummary.counts.sameGenre}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-gray-500">
                    {analytics.spacetimeSummary.recent.length === 0 ? (
                      <li>暂无新分析</li>
                    ) : (
                      analytics.spacetimeSummary.recent.map((item) => (
                        <li key={item.analysisId} className="flex justify-between">
                          <span>
                            {item.username} · {spacetimeTypeLabels[item.analysisType]}
                          </span>
                          <span>{new Date(item.createdAt).toLocaleTimeString('zh-CN')}</span>
                        </li>
                      ))
                    )}
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
      {activityModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 py-10" onClick={handleCloseActivityModal}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">课堂详情</h3>
                <p className="text-sm text-gray-500">
                  {currentSession ? `${currentSession.sessionName} · PIN ${currentSession.sessionPin}` : '请选择课堂'}
                </p>
              </div>
              <GradientButton variant="secondary" onClick={handleCloseActivityModal}>
                关闭
              </GradientButton>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>筛选学生：</span>
                <select
                  className="rounded-md border border-gray-300 px-3 py-1.5"
                  value={activityFilter === 'all' ? 'all' : activityFilter.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActivityFilter(value === 'all' ? 'all' : Number(value));
                  }}
                >
                  <option value="all">全部学生</option>
                  {activityStudentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-gray-400">数据每10秒自动刷新</span>
              {activityLoading ? <span className="text-xs text-purple-500">加载中...</span> : null}
            </div>
            {activityError ? (
              <div className="bg-red-50 px-6 py-3 text-sm text-red-600">{activityError}</div>
            ) : null}
            <div className="max-h-[520px] overflow-y-auto px-6 py-6">
              <div className="grid gap-6 md:grid-cols-2">
                <section className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">对话记录</h4>
                    <p className="text-xs text-gray-500">显示学生与作者的全部对话内容</p>
                  </div>
                  {filteredPrompts.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无对话记录</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredPrompts.map((item) => {
                        const expanded = expandedMessages.has(item.messageId);
                        return (
                          <li key={item.messageId} className="rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{item.username}</span>
                              <span>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
                            </div>
                            <div className="mt-2 whitespace-pre-line text-sm text-gray-800">{item.content}</div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">学生消息</span>
                              {item.aiReply ? (
                                <button
                                  type="button"
                                  onClick={() => toggleMessageExpansion(item.messageId)}
                                  className="rounded-full border border-blue-200 px-2 py-0.5 text-xs text-blue-600 transition hover:bg-blue-100"
                                >
                                  {expanded ? '收起AI回复' : '显示AI回复'}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">暂无AI回复</span>
                              )}
                            </div>
                            {expanded && item.aiReply ? (
                              <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-gray-800">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span className="font-medium text-purple-700">AI 回复</span>
                                  <span>{new Date(item.aiReply.timestamp).toLocaleString('zh-CN')}</span>
                                </div>
                                <div className="mt-2 whitespace-pre-line">{item.aiReply.content}</div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                </section>
                <section className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">图像生成与编辑</h4>
                    <p className="text-xs text-gray-500">记录学生的生成提示与编辑指令</p>
                  </div>
                  {filteredImages.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无图像活动</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredImages.map((item) => (
                        <li key={item.activityId} className="flex gap-3 rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm">
                          <img
                            src={item.imageUrl}
                            alt={item.sceneDescription}
                            className="h-20 w-20 rounded-lg object-cover"
                          />
                          <div className="flex-1 space-y-2 text-sm">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{item.username}</span>
                              <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                                item.actionType === 'generation'
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-orange-100 text-orange-600'
                              }`}
                            >
                              {item.actionType === 'generation' ? '初次生成' : '编辑优化'}
                            </span>
                            <div className="whitespace-pre-line text-gray-800">
                              {item.actionType === 'generation' ? `生成描述：${item.instruction}` : `编辑指令：${item.instruction}`}
                            </div>
                            <p className="text-xs text-gray-500">风格：{item.style}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="space-y-4 md:col-span-2">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">构建时空分析</h4>
                    <p className="text-xs text-gray-500">查看学生生成的时代、流派与对比提纲</p>
                  </div>
                  {filteredSpacetime.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无构建时空记录</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredSpacetime.map((item) => (
                        <li
                          key={item.analysisId}
                          className="space-y-3 rounded-xl border border-gray-200 bg-white/85 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-600">
                                {spacetimeTypeLabels[item.analysisType]}
                              </span>
                              <span className="font-medium text-gray-700">{item.username}</span>
                            </div>
                            <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-700">
                            <p>
                              <span className="font-medium">作者：</span>
                              {item.author}
                              <span className="mx-2 text-gray-400">·</span>
                              <span className="font-medium">作品：</span>
                              {item.workTitle}
                            </p>
                            <p>
                              <span className="font-medium">时代：</span>
                              {item.era}
                              <span className="mx-2 text-gray-400">·</span>
                              <span className="font-medium">流派：</span>
                              {item.genre}
                            </p>
                            {item.focusScope ? (
                              <p>
                                <span className="font-medium">聚焦：</span>
                                {item.focusScope}
                              </p>
                            ) : null}
                            {item.promptNotes ? (
                              <p className="text-xs text-gray-500">学生补充：{item.promptNotes}</p>
                            ) : null}
                          </div>
                          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-line">
                            {item.generatedContent}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TeacherDashboardPage;
