import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import TextInput from '../../components/TextInput';
import GradientButton from '../../components/GradientButton';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import LifeJourneyMap from '../../components/LifeJourneyMap';
import { CalendarDaysIcon, MapPinIcon, BookOpenIcon, SparklesIcon } from '@heroicons/react/24/solid';
import type {
  TeacherSession,
  StudentCredential,
  SessionActivityFeed,
  SessionActivityMessage,
  SpacetimeAnalysisType,
  TeacherTaskSummary,
  SessionTaskFeature,
  LifeJourneyResponse,
  LifeJourneyLocation,
  LifeJourneyEntryInput
} from '../../types';
import TextArea from '../../components/TextArea';

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

interface TaskDraft {
  title: string;
  description: string;
  feature: SessionTaskFeature;
  isRequired: boolean;
}

const taskFeatureOptions: Array<{ value: SessionTaskFeature; label: string }> = [
  { value: 'chat', label: '与作者对话' },
  { value: 'writing', label: '描述性写作' },
  { value: 'workshop', label: '协作创作' },
  { value: 'analysis', label: '对比分析' },
  { value: 'journey', label: '人生行迹' },
  { value: 'gallery', label: '课堂画廊互动' }
];

const spacetimeTypeLabels: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '中外文学对比',
  sameEra: '同代作者梳理',
  sameGenre: '同流派前后对比',
  custom: '自定义方案'
};

const JOURNEY_POLL_INITIAL_DELAY = 5000;
const JOURNEY_POLL_DELAY_INCREMENT = 5000;
const JOURNEY_POLL_MAX_ATTEMPTS = 30;

type JourneyFetchResult = {
  generatedAt: string | null;
  generating: boolean;
  errorMessage: string | null;
};

const TeacherDashboardPage = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logoutTeacher);
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [credentials, setCredentials] = useState<StudentCredential[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [taskSummary, setTaskSummary] = useState<TeacherTaskSummary | null>(null);
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
  const [journeyData, setJourneyData] = useState<LifeJourneyResponse | null>(null);
  const [journeyGeneratedAt, setJourneyGeneratedAt] = useState<string | null>(null);
  const [journeyLocation, setJourneyLocation] = useState<LifeJourneyLocation | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [journeyNotice, setJourneyNotice] = useState<string | null>(null);
  const [journeyEntries, setJourneyEntries] = useState<LifeJourneyEntryInput[]>([]);
  const [journeyComposerVisible, setJourneyComposerVisible] = useState(false);
  const [journeyGenerating, setJourneyGenerating] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [journeyCurrentLocation, setJourneyCurrentLocation] = useState<number | null>(null);
  const [journeyTotalLocations, setJourneyTotalLocations] = useState(0);
  const [journeyLocationStatuses, setJourneyLocationStatuses] = useState<Array<{
    name: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
  }>>([]);
  const journeyPollTimeoutRef = useRef<number | null>(null);

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

  const fetchTaskSummary = async (sessionId: number) => {
    try {
      const response = await client.get(`/teacher/sessions/${sessionId}/tasks`);
      setTaskSummary(response.data.summary ?? null);
    } catch (error) {
      console.error(error);
      setTaskSummary(null);
    }
  };

  const fetchJourney = useCallback(
    async (sessionId: number, silent = false): Promise<JourneyFetchResult | null> => {
      if (!silent) {
        setJourneyError(null);
        setJourneyNotice(null);
        setJourneyLoading(true);
      }

      try {
        const response = await client.get(`/teacher/sessions/${sessionId}/life-journey`);
        const journey = response.data?.journey as LifeJourneyResponse | null | undefined;
        const generatedAt = typeof response.data?.generatedAt === 'string' ? response.data.generatedAt : null;
        const generating = Boolean(response.data?.generating);
        const rawError =
          typeof response.data?.errorMessage === 'string' ? response.data.errorMessage.trim() : '';
        const errorMessage = rawError.length > 0 ? rawError : null;

        // Always update journey data if we got valid data (even if generating)
        // This ensures existing trajectory is shown while generating
        if (journey) {
          setJourneyData(journey);
          setJourneyGeneratedAt(generatedAt);
          setJourneyLocation(journey.locations?.[0] ?? null);
        }

        setJourneyGenerating(generating);

        if (errorMessage && !generating) {
          setJourneyError(errorMessage);
          setJourneyNotice(null);
        } else if (!errorMessage) {
          setJourneyError(null);
        }

        if (!silent) {
          if (generating) {
            setJourneyNotice('AI 正在生成新的行迹，请稍候...');
          } else if (journey) {
            setJourneyNotice('最新人生行迹已加载');
          } else if (!errorMessage) {
            setJourneyNotice('尚未生成行迹，请点击上方按钮进行生成。');
          }
        }

        return { generatedAt, generating, errorMessage };
      } catch (error) {
        if (!silent) {
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            setJourneyError(error.response.data.message);
          } else {
            setJourneyError('人生行迹加载失败，请稍后再试');
          }
          setJourneyNotice(null);
        }
        return null;
      } finally {
        if (!silent) {
          setJourneyLoading(false);
        }
      }
    },
    []
  );

  const fetchJourneyProgress = useCallback(async (sessionId: number) => {
    try {
      const response = await client.get(`/teacher/sessions/${sessionId}/life-journey/progress`);
      const { status, progress, currentLocation, totalLocations, locations } = response.data;

      setJourneyProgress(progress);
      setJourneyCurrentLocation(currentLocation);
      setJourneyTotalLocations(totalLocations);
      setJourneyLocationStatuses(locations || []);

      return { status, progress, errorMessage: response.data.errorMessage };
    } catch (error) {
      console.error('Failed to fetch progress', error);
      return null;
    }
  }, []);

  const scheduleJourneyPoll = useCallback(
    (sessionId: number, previousGeneratedAt: string | null, attempt = 0) => {
      if (journeyPollTimeoutRef.current) {
        window.clearTimeout(journeyPollTimeoutRef.current);
        journeyPollTimeoutRef.current = null;
      }

      // Shorter polling interval for smoother progress updates
      const delay = 3000;

      journeyPollTimeoutRef.current = window.setTimeout(async () => {
        // Check progress first
        const progressResult = await fetchJourneyProgress(sessionId);

        if (!progressResult) {
          // If progress check fails, fallback to old behavior or retry
          if (attempt >= JOURNEY_POLL_MAX_ATTEMPTS) {
            setJourneyGenerating(false);
            setJourneyError('无法获取生成进度，请稍后再试。');
            return;
          }
          scheduleJourneyPoll(sessionId, previousGeneratedAt, attempt + 1);
          return;
        }

        const { status, errorMessage } = progressResult;

        if (status === 'failed') {
          setJourneyGenerating(false);
          setJourneyError(errorMessage || '生成失败，请重试');
          setJourneyNotice(null);
          return;
        }

        if (status === 'completed') {
          // Generation done, fetch final result
          await fetchJourney(sessionId);
          setJourneyGenerating(false);
          setJourneyNotice('人生行迹生成成功，学生端已同步更新');
          return;
        }

        if (status === 'in_progress' || status === 'pending') {
          setJourneyGenerating(true);
          // Continue polling
          scheduleJourneyPoll(sessionId, previousGeneratedAt, attempt + 1);
          return;
        }

        // If status is 'none' but we thought we were generating, maybe it finished or hasn't started?
        // Fallback to checking the journey endpoint directly
        const result = await fetchJourney(sessionId, true);
        if (result?.generating) {
          scheduleJourneyPoll(sessionId, previousGeneratedAt, attempt + 1);
        } else {
          setJourneyGenerating(false);
        }
      }, delay);
    },
    [fetchJourney, fetchJourneyProgress]
  );

  const refreshCurrentSession = async () => {
    if (!selectedSession) {
      await fetchSessions();
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const [, , , , journeyResult] = await Promise.all([
        fetchSessions(),
        fetchStudents(selectedSession),
        fetchAnalytics(selectedSession),
        fetchTaskSummary(selectedSession),
        fetchJourney(selectedSession, true)
      ]);

      if (journeyResult?.generating) {
        scheduleJourneyPoll(selectedSession, journeyResult.generatedAt ?? null, 0);
      }

      setMessage('课堂数据已刷新');
    } catch (error) {
      console.error(error);
      setMessage('刷新失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (journeyPollTimeoutRef.current) {
      window.clearTimeout(journeyPollTimeoutRef.current);
      journeyPollTimeoutRef.current = null;
    }

    if (selectedSession) {
      setJourneyError(null);
      setJourneyNotice(null);
      setJourneyComposerVisible(false);
      setJourneyEntries([]);
      fetchStudents(selectedSession);
      fetchAnalytics(selectedSession);
      fetchTaskSummary(selectedSession);
      void fetchJourney(selectedSession, true).then((result) => {
        if (result?.generating) {
          scheduleJourneyPoll(selectedSession, result.generatedAt ?? null, 0);
        }
      });
    } else {
      setTaskSummary(null);
      setJourneyData(null);
      setJourneyLocation(null);
      setJourneyGeneratedAt(null);
      setJourneyError(null);
      setJourneyNotice(null);
      setJourneyComposerVisible(false);
      setJourneyEntries([]);
      setJourneyGenerating(false);
    }
  }, [selectedSession, fetchJourney, scheduleJourneyPoll]);

  useEffect(() => {
    return () => {
      if (journeyPollTimeoutRef.current) {
        window.clearTimeout(journeyPollTimeoutRef.current);
      }
    };
  }, []);

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

  const handleAddTaskDraft = () => {
    setTaskDrafts((prev) => [...prev, { title: '', description: '', feature: 'writing', isRequired: true }]);
  };

  const handleTaskDraftChange = <K extends keyof TaskDraft>(index: number, key: K, value: TaskDraft[K]) => {
    setTaskDrafts((prev) =>
      prev.map((task, i) => (i === index ? { ...task, [key]: value } : task))
    );
  };

  const handleRemoveTaskDraft = (index: number) => {
    setTaskDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const taskPayload = taskDrafts.reduce<Array<{ title: string; description?: string; feature: SessionTaskFeature; isRequired: boolean; orderIndex: number }>>((acc, task, index) => {
        const title = task.title.trim();
        if (!title) {
          return acc;
        }
        const description = task.description.trim();
        acc.push({
          title,
          description: description ? description : undefined,
          feature: task.feature,
          isRequired: task.isRequired,
          orderIndex: index
        });
        return acc;
      }, []);

      await client.post('/teacher/sessions', { ...formData, tasks: taskPayload });
      setFormData({ sessionName: '', sessionPin: '', authorName: '', literatureTitle: '' });
      setTaskDrafts([]);
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

  const handleOpenJourneyComposer = () => {
    if (!selectedSession) {
      setJourneyError('请先选择课堂会话');
      return;
    }
    setJourneyError(null);
    setJourneyNotice(null);
    setJourneyComposerVisible(true);
  };

  const handleCancelJourneyComposer = () => {
    if (journeyLoading || journeyGenerating) {
      // Don't allow canceling during generation
      return;
    }
    setJourneyComposerVisible(false);
    setJourneyEntries([]);
  };

  const handleAddJourneyEntry = () => {
    setJourneyEntries((prev) => [
      ...prev,
      {
        startYear: null,
        endYear: null,
        ancientName: null,
        modernName: null,
        events: null,
        geography: null,
        poems: null
      }
    ]);
  };

  const handleRemoveJourneyEntry = (index: number) => {
    setJourneyEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateJourneyEntry = <K extends keyof LifeJourneyEntryInput>(
    index: number,
    key: K,
    value: LifeJourneyEntryInput[K]
  ) => {
    setJourneyEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
    );
  };

  const hasAnyEntryField = (entry: LifeJourneyEntryInput): boolean => {
    return !!(
      entry.startYear ||
      entry.endYear ||
      (entry.ancientName && entry.ancientName.trim()) ||
      (entry.modernName && entry.modernName.trim()) ||
      (entry.events && entry.events.trim()) ||
      (entry.geography && entry.geography.trim()) ||
      (entry.poems && entry.poems.trim())
    );
  };

  const handleGenerateJourney = async () => {
    if (!selectedSession) {
      setJourneyError('请先选择课堂会话');
      return;
    }

    if (journeyGenerating) {
      // Prevent multiple simultaneous generation requests
      return;
    }

    setJourneyLoading(true);
    setJourneyError(null);
    setJourneyNotice(null);

    try {
      const previousGeneratedAt = journeyGeneratedAt ?? null;
      const previousJourneyData = journeyData; // Store previous data
      const validEntries = journeyEntries.filter(hasAnyEntryField);

      const response = await client.post(`/teacher/sessions/${selectedSession}/life-journey`, {
        entries: validEntries.length > 0 ? validEntries : undefined
      });

      // Close composer immediately to show generating state
      setJourneyComposerVisible(false);
      // Keep entries for potential retry

      if (response.status === 202) {
        // Generation started - show explicit generating state
        setJourneyGenerating(true);
        setJourneyNotice('AI 正在生成新的行迹，请稍候...');
        // Start polling for completion
        scheduleJourneyPoll(selectedSession, previousGeneratedAt, 0);
        return;
      }

      // Immediate response (shouldn't happen with current backend, but handle gracefully)
      const journey = response.data?.journey as LifeJourneyResponse | null | undefined;
      const generatedAt = typeof response.data?.generatedAt === 'string' ? response.data.generatedAt : null;

      if (journey) {
        // Only update if we got valid data
        setJourneyData(journey);
        setJourneyGeneratedAt(generatedAt);
        setJourneyLocation(journey.locations?.[0] ?? null);
        setJourneyGenerating(false);
        setJourneyNotice('人生行迹生成成功，学生端已同步更新');
      } else {
        // No data in response - keep existing data
        setJourneyGenerating(false);
        setJourneyNotice('生成请求已提交，请稍候查看结果');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 409) {
          // Already generating - sync state and start polling
          setJourneyGenerating(true);
          setJourneyNotice('AI 正在生成新的行迹，请稍候...');
          scheduleJourneyPoll(selectedSession, journeyGeneratedAt ?? null, 0);
        } else if (error.response.data?.message) {
          setJourneyError(error.response.data.message as string);
          setJourneyGenerating(false);
          // Keep existing journey data on error
        } else {
          setJourneyError('生成人生行迹失败，请稍后再试');
          setJourneyGenerating(false);
        }
      } else {
        setJourneyError('生成人生行迹失败，请稍后再试');
        setJourneyGenerating(false);
      }
    } finally {
      setJourneyLoading(false);
    }
  };

  const handleRefreshJourney = useCallback(async () => {
    if (!selectedSession) {
      return;
    }
    const result = await fetchJourney(selectedSession);
    if (result?.generating) {
      scheduleJourneyPoll(selectedSession, result.generatedAt ?? null, 0);
    }
  }, [selectedSession, fetchJourney, scheduleJourneyPoll]);

  const formattedJourneyGeneratedAt = useMemo(() => {
    if (!journeyGeneratedAt) {
      return null;
    }
    const date = new Date(journeyGeneratedAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleString('zh-CN');
  }, [journeyGeneratedAt]);

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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">教师控制面板</h1>
            <p className="mt-1 text-xs text-gray-500">管理课堂会话、学生账号与课堂活动</p>
          </div>
          <GradientButton variant="secondary" onClick={handleLogout}>
            退出登录
          </GradientButton>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">创建新课堂会话</h2>
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
              <div className="md:col-span-2 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">任务清单（可选）</h3>
                    <p className="text-xs text-gray-500">为学生设定课堂内需要完成的作业或练习。</p>
                  </div>
                  <GradientButton variant="secondary" type="button" onClick={handleAddTaskDraft}>
                    添加任务
                  </GradientButton>
                </div>
                {taskDrafts.length === 0 ? (
                  <p className="rounded-lg bg-white p-3 text-sm text-gray-500">暂未添加任务。</p>
                ) : (
                  <div className="space-y-3">
                    {taskDrafts.map((task, index) => (
                      <div key={index} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start">
                          <div className="flex-1 space-y-3">
                            <TextInput
                              label={`任务名称 ${index + 1}`}
                              placeholder="例如：提交描述性写作成果"
                              value={task.title}
                              onChange={(e) => handleTaskDraftChange(index, 'title', e.target.value)}
                            />
                            <TextArea
                              label="任务说明"
                              placeholder="说明需要学生完成的具体内容"
                              value={task.description}
                              onChange={(e) => handleTaskDraftChange(index, 'description', e.target.value)}
                              rows={3}
                            />
                          </div>
                          <div className="w-full space-y-3 md:w-56">
                            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                              <span>关联功能</span>
                              <select
                                value={task.feature}
                                onChange={(e) => handleTaskDraftChange(index, 'feature', e.target.value as SessionTaskFeature)}
                                className="rounded-lg border border-gray-200 px-3 py-2"
                              >
                                {taskFeatureOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={task.isRequired}
                                onChange={(e) => handleTaskDraftChange(index, 'isRequired', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-lavender-600 focus:ring-lavender-500"
                              />
                              必做任务
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveTaskDraft(index)}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 hover:border-gray-300"
                            >
                              删除任务
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <GradientButton variant="primary" className="md:col-span-2" type="submit" disabled={loading}>
                {loading ? '提交中...' : '创建会话'}
              </GradientButton>
            </form>
            {message ? <p className="text-sm text-lavender-600">{message}</p> : null}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">课堂列表</h2>
              <div className="flex items-center gap-3">
                <GradientButton variant="secondary" onClick={refreshCurrentSession}>
                  刷新数据
                </GradientButton>
                <GradientButton variant="primary" onClick={handleOpenActivityModal} disabled={!selectedSession}>
                  课堂详情
                </GradientButton>
                <select
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-lavender-400 focus:outline-none focus:ring-1 focus:ring-lavender-400"
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
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-2.5">序号</th>
                    <th className="px-4 py-2.5">用户名</th>
                    <th className="px-4 py-2.5">初始密码</th>
                    <th className="px-4 py-2.5">状态</th>
                    <th className="px-4 py-2.5">首次登录</th>
                    <th className="px-4 py-2.5">最近活动</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
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

          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  人生行迹{journeyData ? ` - ${journeyData.heroName}` : ''}
                </h2>
                <p className="text-xs text-gray-500">生成或预览作者的 AI 行迹地图，学生端将同步更新。</p>
                {journeyGenerating ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-lavender-100 px-2 py-0.5 text-xs text-lavender-600">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lavender-500" />
                    AI 正在生成中...
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2 text-right text-xs text-gray-500">
                {formattedJourneyGeneratedAt ? <span>最近生成：{formattedJourneyGeneratedAt}</span> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {selectedSession ? (
                    <GradientButton
                      variant="secondary"
                      onClick={handleRefreshJourney}
                      disabled={journeyLoading || journeyGenerating}
                    >
                      {journeyLoading ? '加载中...' : '刷新预览'}
                    </GradientButton>
                  ) : null}
                  <GradientButton
                    variant="primary"
                    onClick={handleOpenJourneyComposer}
                    disabled={!selectedSession || journeyLoading || journeyGenerating}
                  >
                    {journeyGenerating
                      ? '正在生成中...'
                      : journeyData
                        ? '重新生成人生行迹'
                        : '用AI创建人生行迹'}
                  </GradientButton>
                </div>
              </div>
            </div>

            {!selectedSession ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                请选择课堂会话以配置人生行迹。
              </p>
            ) : (
              <>
                {journeyGenerating ? (
                  <div className="rounded-lg border border-lavender-200 bg-lavender-50 px-4 py-4 mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-lavender-200 border-t-lavender-600" />
                        <p className="text-sm font-medium text-lavender-700">
                          AI 正在生成人生行迹... {journeyProgress}%
                        </p>
                      </div>
                      <span className="text-xs text-lavender-600">
                        {journeyCurrentLocation !== null && journeyTotalLocations > 0
                          ? `正在生成第 ${journeyCurrentLocation + 1} / ${journeyTotalLocations} 个地点`
                          : '准备中...'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-lavender-200">
                      <div
                        className="h-full bg-lavender-500 transition-all duration-500 ease-out"
                        style={{ width: `${journeyProgress}%` }}
                      />
                    </div>

                    {/* Location Status List */}
                    {journeyLocationStatuses.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {journeyLocationStatuses.map((loc, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs">
                            {loc.status === 'completed' ? (
                              <span className="text-green-500">✓</span>
                            ) : loc.status === 'generating' ? (
                              <span className="animate-pulse text-lavender-500">●</span>
                            ) : loc.status === 'failed' ? (
                              <span className="text-red-500">✕</span>
                            ) : (
                              <span className="text-gray-300">○</span>
                            )}
                            <span className={`${loc.status === 'completed' ? 'text-gray-700' :
                              loc.status === 'generating' ? 'font-medium text-lavender-700' :
                                loc.status === 'failed' ? 'text-red-600' :
                                  'text-gray-400'
                              } truncate`}>
                              {loc.name || `地点 ${idx + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {journeyNotice && !journeyGenerating ? (
                  <p className="rounded-lg bg-lavender-50 px-4 py-2 text-sm text-lavender-600">{journeyNotice}</p>
                ) : null}
                {journeyError && !journeyGenerating ? (
                  <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{journeyError}</p>
                ) : null}
                {journeyComposerVisible ? (
                  <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="rounded-lg border border-lavender-200 bg-lavender-50 p-4">
                      <p className="text-sm font-semibold text-lavender-700">
                        📝 手动输入确保准确性
                      </p>
                      <p className="mt-2 text-xs text-lavender-600 leading-relaxed">
                        您可以为作者人生中的<strong>特定阶段</strong>添加手动条目。这些条目中填写的字段将<strong>确保准确显示</strong>在最终地图上。
                        AI 将自动生成作者的<strong>完整人生轨迹</strong>（通常 3-12 个阶段），包括您手动指定阶段的前后时期。
                        空白字段将由 AI 自动补全。
                      </p>
                      <div className="mt-3 rounded-lg bg-white/50 p-3 text-xs text-lavender-700">
                        <p className="font-medium">💡 示例</p>
                        <p className="mt-1 text-lavender-600">
                          如果您想强调作者 725-728 年的某个重要时期，只需添加一个条目填写这些年份和相关信息。
                          AI 会自动生成该时期之前和之后的其他人生阶段，形成完整的生平轨迹。
                        </p>
                      </div>
                      {journeyEntries.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-lavender-700">
                          <span className="font-medium">已添加 {journeyEntries.length} 个手动条目</span>
                          <span className="text-lavender-500">•</span>
                          <span>
                            {journeyEntries.filter(hasAnyEntryField).length} 个包含数据
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {journeyEntries.map((entry, index) => {
                        const filledFieldCount = [
                          entry.startYear,
                          entry.endYear,
                          entry.ancientName?.trim(),
                          entry.modernName?.trim(),
                          entry.events?.trim(),
                          entry.geography?.trim(),
                          entry.poems?.trim()
                        ].filter(Boolean).length;

                        return (
                          <div
                            key={index}
                            className="rounded-lg border border-gray-200 bg-white p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">
                                  条目 {index + 1}
                                </span>
                                {filledFieldCount > 0 && (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    ✓ {filledFieldCount} 个字段已填写
                                  </span>
                                )}
                                {filledFieldCount === 0 && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                    空白 - 将由 AI 生成
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveJourneyEntry(index)}
                                className="text-xs text-gray-500 transition hover:text-gray-700"
                                disabled={journeyLoading || journeyGenerating}
                              >
                                删除
                              </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <TextInput
                                  label="起始年份"
                                  type="number"
                                  placeholder="例如：732"
                                  value={entry.startYear?.toString() ?? ''}
                                  onChange={(e) =>
                                    handleUpdateJourneyEntry(
                                      index,
                                      'startYear',
                                      e.target.value ? parseInt(e.target.value, 10) : null
                                    )
                                  }
                                  disabled={journeyLoading || journeyGenerating}
                                />
                                {!entry.startYear && (
                                  <p className="mt-1 text-xs text-gray-500">留空将由 AI 推断</p>
                                )}
                              </div>
                              <div>
                                <TextInput
                                  label="终止年份"
                                  type="number"
                                  placeholder="例如：735"
                                  value={entry.endYear?.toString() ?? ''}
                                  onChange={(e) =>
                                    handleUpdateJourneyEntry(
                                      index,
                                      'endYear',
                                      e.target.value ? parseInt(e.target.value, 10) : null
                                    )
                                  }
                                  disabled={journeyLoading || journeyGenerating}
                                />
                                {!entry.endYear && (
                                  <p className="mt-1 text-xs text-gray-500">留空将由 AI 推断</p>
                                )}
                              </div>
                              <TextInput
                                label="古代地名"
                                placeholder="例如：洛阳"
                                value={entry.ancientName ?? ''}
                                onChange={(e) =>
                                  handleUpdateJourneyEntry(index, 'ancientName', e.target.value || null)
                                }
                                disabled={journeyLoading || journeyGenerating}
                              />
                              <TextInput
                                label="现代地名"
                                placeholder="例如：河南洛阳"
                                value={entry.modernName ?? ''}
                                onChange={(e) =>
                                  handleUpdateJourneyEntry(index, 'modernName', e.target.value || null)
                                }
                                disabled={journeyLoading || journeyGenerating}
                              />
                            </div>

                            <div className="mt-3 space-y-3">
                              <TextArea
                                label="关键事件"
                                placeholder="描述该时间段发生的关键事件"
                                value={entry.events ?? ''}
                                onChange={(e) =>
                                  handleUpdateJourneyEntry(index, 'events', e.target.value || null)
                                }
                                rows={2}
                                disabled={journeyLoading || journeyGenerating}
                              />
                              <TextArea
                                label="地理风物"
                                placeholder="描述该地点的地形、植被、水域、气候等"
                                value={entry.geography ?? ''}
                                onChange={(e) =>
                                  handleUpdateJourneyEntry(index, 'geography', e.target.value || null)
                                }
                                rows={2}
                                disabled={journeyLoading || journeyGenerating}
                              />
                              <TextArea
                                label="代表诗作"
                                placeholder="列出该阶段或地点的代表诗作（标题和内容）"
                                value={entry.poems ?? ''}
                                onChange={(e) =>
                                  handleUpdateJourneyEntry(index, 'poems', e.target.value || null)
                                }
                                rows={3}
                                disabled={journeyLoading || journeyGenerating}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <GradientButton
                        variant="secondary"
                        type="button"
                        onClick={handleAddJourneyEntry}
                        disabled={journeyLoading || journeyGenerating}
                      >
                        添加条目
                      </GradientButton>
                      <div className="flex-1" />
                      <GradientButton
                        variant="primary"
                        onClick={handleGenerateJourney}
                        disabled={journeyLoading || journeyGenerating}
                      >
                        {journeyGenerating
                          ? '正在生成中...'
                          : journeyLoading
                            ? '提交中...'
                            : '生成人生行迹'}
                      </GradientButton>
                      <GradientButton
                        variant="secondary"
                        type="button"
                        onClick={handleCancelJourneyComposer}
                        disabled={journeyLoading || journeyGenerating}
                      >
                        取消
                      </GradientButton>
                    </div>
                  </div>
                ) : null}
                {journeyGenerating && !journeyData && !journeyComposerVisible ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                    <span className="inline-flex h-12 w-12 animate-spin rounded-full border-2 border-lavender-200 border-t-lavender-600" />
                    <p className="text-sm font-medium text-gray-700">AI 正在生成人生行迹...</p>
                    <p className="text-xs text-gray-600">这可能需要几分钟时间，请耐心等待</p>
                  </div>
                ) : journeyData ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                      <div className="h-[420px] overflow-hidden rounded-lg border border-gray-200">
                        <LifeJourneyMap locations={journeyData.locations} onSelect={setJourneyLocation} />
                      </div>
                      <aside className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        {(() => {
                          const current = journeyLocation ?? journeyData.locations[0];
                          if (!current) {
                            return <p className="text-sm text-gray-500">暂无行迹信息。</p>;
                          }
                          return (
                            <div className="space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-semibold text-lavender-600">{current.name}</h3>
                                  {current.modernName ? (
                                    <p className="text-xs text-gray-500">今 {current.modernName}</p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setJourneyLocation(null)}
                                  className="text-xs text-gray-400 transition hover:text-gray-600"
                                >
                                  重置
                                </button>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-white p-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-lavender-600">
                                  <CalendarDaysIcon className="h-4 w-4" />
                                  <span>{current.period}</span>
                                </div>
                                <p className="mt-2 text-sm text-gray-600">{current.description}</p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <MapPinIcon className="h-4 w-4 text-lavender-500" />
                                  关键事件
                                </div>
                                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                                  {current.events.map((event, index) => (
                                    <li key={index}>{event}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <SparklesIcon className="h-4 w-4 text-lavender-500" />
                                  地理风物
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
                                  <p><strong>地形：</strong>{current.geography.terrain}</p>
                                  <p className="mt-1"><strong>植被：</strong>{current.geography.vegetation}</p>
                                  <p className="mt-1"><strong>水域：</strong>{current.geography.water}</p>
                                  <p className="mt-1"><strong>气候：</strong>{current.geography.climate}</p>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <BookOpenIcon className="h-4 w-4 text-lavender-500" />
                                  代表诗作
                                </div>
                                {current.poems.map((poem, index) => (
                                  <div
                                    key={index}
                                    className="rounded-lg bg-lavender-50 p-3 text-sm text-gray-700"
                                  >
                                    <p className="font-medium text-lavender-600">《{poem.title}》</p>
                                    <p className="mt-1 whitespace-pre-line leading-relaxed">{poem.content}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </aside>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-5">
                      <h3 className="text-base font-semibold text-gray-900">行迹概览</h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">{journeyData.summary}</p>
                      {journeyData.highlights && journeyData.highlights.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">关键看点</h4>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
                            {journeyData.highlights.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {journeyData.routeNotes ? (
                        <p className="mt-3 text-xs text-gray-500">{journeyData.routeNotes}</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    暂未生成行迹。点击上方按钮即可调用 AI 构建可共享的人生行迹。
                  </p>
                )}
              </>
            )}
          </Card>
        </section>

        <section className="space-y-5">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">学生账号生成器</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between text-sm text-gray-600">
                <span>生成数量（1-50）</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-lavender-400 focus:outline-none focus:ring-1 focus:ring-lavender-400"
                />
              </label>
              <GradientButton onClick={handleGenerateStudents} disabled={loading}>
                {loading ? '生成中...' : '生成账号'}
              </GradientButton>
              {credentials.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">任务完成情况</h2>
              <span className="text-xs text-gray-500">学生完成状态实时更新</span>
            </div>
            {!selectedSession ? (
              <p className="text-sm text-gray-500">请选择课堂会话以查看任务。</p>
            ) : taskSummary && taskSummary.tasks.length > 0 ? (
              <div className="space-y-3">
                {taskSummary.tasks.map((task) => (
                  <div key={task.taskId} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {task.title}
                          {!task.isRequired ? (
                            <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">选做</span>
                          ) : null}
                        </p>
                        {task.description ? <p className="text-xs text-gray-500">{task.description}</p> : null}
                      </div>
                      <span className="text-xs text-gray-500">
                        已提交 {task.submittedCount}/{taskSummary.studentCount}
                      </span>
                    </div>
                    {task.submissions.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-gray-600">
                        {task.submissions.map((submission) => (
                          <li key={submission.submissionId} className="rounded bg-gray-50 px-2 py-1">
                            <span className="font-medium text-gray-700">{submission.username}</span>
                            <span className="mx-1 text-gray-400">·</span>
                            <span>{new Date(submission.updatedAt).toLocaleString('zh-CN')}</span>
                            <span className="mx-1 text-gray-400">·</span>
                            <span>{submission.status === 'resubmitted' ? '已重新提交' : '已提交'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400">暂无学生提交。</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">尚未设置任务。</p>
            )}
          </Card>

          {students.length > 0 ? (
            <Card className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">课堂账号总览</h3>
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
            <h2 className="text-lg font-semibold text-gray-900">课堂活动监控</h2>
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
                  <h3 className="font-semibold text-gray-800">对比分析</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="rounded-full bg-lavender-50 px-2 py-0.5 text-lavender-700">
                      中外对比：{analytics.spacetimeSummary.counts.crossCulture}
                    </span>
                    <span className="rounded-full bg-lavender-50 px-2 py-0.5 text-lavender-700">
                      同时代：{analytics.spacetimeSummary.counts.sameEra}
                    </span>
                    <span className="rounded-full bg-lavender-50 px-2 py-0.5 text-lavender-700">
                      同流派：{analytics.spacetimeSummary.counts.sameGenre}
                    </span>
                    <span className="rounded-full bg-lavender-50 px-2 py-0.5 text-lavender-700">
                      自定义：{analytics.spacetimeSummary.counts.custom}
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
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 px-4 py-10" onClick={handleCloseActivityModal}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">课堂详情</h3>
                <p className="text-sm text-gray-500">
                  {currentSession ? `${currentSession.sessionName} · PIN ${currentSession.sessionPin}` : '请选择课堂'}
                </p>
              </div>
              <GradientButton variant="secondary" onClick={handleCloseActivityModal}>
                关闭
              </GradientButton>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>筛选学生：</span>
                <select
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-lavender-400 focus:outline-none focus:ring-1 focus:ring-lavender-400"
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
              {activityLoading ? <span className="text-xs text-lavender-600">加载中...</span> : null}
            </div>
            {activityError ? (
              <div className="bg-red-50 px-6 py-3 text-sm text-red-600">{activityError}</div>
            ) : null}
            <div className="max-h-[520px] overflow-y-auto px-6 py-6">
              <div className="grid gap-6 md:grid-cols-2">
                <section className="space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">对话记录</h4>
                    <p className="text-xs text-gray-500">显示学生与作者的全部对话内容</p>
                  </div>
                  {filteredPrompts.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无对话记录</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredPrompts.map((item) => {
                        const expanded = expandedMessages.has(item.messageId);
                        return (
                          <li key={item.messageId} className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{item.username}</span>
                              <span>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
                            </div>
                            <div className="mt-2 rounded-lg bg-gray-50 p-3">
                              <MarkdownRenderer content={item.content} />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-lavender-100 px-2 py-0.5 text-xs text-lavender-600">学生消息</span>
                              {item.aiReply ? (
                                <button
                                  type="button"
                                  onClick={() => toggleMessageExpansion(item.messageId)}
                                  className="rounded-full border border-lavender-200 px-2 py-0.5 text-xs text-lavender-600 transition hover:bg-lavender-50"
                                >
                                  {expanded ? '收起AI回复' : '显示AI回复'}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">暂无AI回复</span>
                              )}
                            </div>
                            {expanded && item.aiReply ? (
                              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span className="font-medium text-lavender-600">AI 回复</span>
                                  <span>{new Date(item.aiReply.timestamp).toLocaleString('zh-CN')}</span>
                                </div>
                                <div className="mt-2 rounded-lg bg-white p-2">
                                  <MarkdownRenderer content={item.aiReply.content} />
                                </div>
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
                    <h4 className="text-base font-semibold text-gray-900">图像生成与编辑</h4>
                    <p className="text-xs text-gray-500">记录学生的生成提示与编辑指令</p>
                  </div>
                  {filteredImages.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无图像活动</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredImages.map((item) => (
                        <li key={item.activityId} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3">
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
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs ${item.actionType === 'generation'
                                ? 'bg-lavender-100 text-lavender-600'
                                : 'bg-gray-100 text-gray-600'
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
                    <h4 className="text-base font-semibold text-gray-900">对比分析提纲</h4>
                    <p className="text-xs text-gray-500">查看学生生成的时代、流派与对比提纲</p>
                  </div>
                  {filteredSpacetime.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无对比分析记录</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredSpacetime.map((item) => (
                        <li
                          key={item.analysisId}
                          className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-lavender-100 px-2 py-0.5 text-lavender-600">
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
                            {item.customInstruction ? (
                              <p className="text-xs text-lavender-600">自定义指令：{item.customInstruction}</p>
                            ) : null}
                          </div>
                          <div className="rounded-xl bg-gray-50 p-3">
                            <MarkdownRenderer content={item.generatedContent} />
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
