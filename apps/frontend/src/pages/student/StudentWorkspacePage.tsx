import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import GradientButton from '../../components/GradientButton';
import FeatureButton from '../../components/FeatureButton';
import TextArea from '../../components/TextArea';
import TextInput from '../../components/TextInput';
import ChatBubble from '../../components/ChatBubble';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import LifeJourneyMap from '../../components/LifeJourneyMap';
import WorkshopPanel from '../../components/WorkshopPanel';
import { MapPinIcon, CalendarDaysIcon, BookOpenIcon, SparklesIcon } from '@heroicons/react/24/solid';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type {
  StudentGalleryItem,
  StudentSpacetimeAnalysis,
  SpacetimeAnalysisType,
  LifeJourneyResponse,
  LifeJourneyLocation,
  GalleryComment,
  StudentTask,
  SessionTaskFeature
} from '../../types';

interface ChatMessage {
  messageId: number;
  senderType: 'student' | 'ai';
  content: string;
  timestamp: string;
}

interface SessionInfo {
  sessionName: string;
  authorName: string;
  literatureTitle: string;
}

interface GeneratedImage {
  imageId: number;
  style: string;
  sceneDescription: string;
  imageUrl: string;
  editCount: number;
  isShared: boolean;
}

type FeatureKey = 'chat' | 'writing' | 'analysis' | 'journey' | 'workshop' | 'gallery';

interface ImageVersion {
  imageUrl: string;
  style: string;
  sceneDescription: string;
  editCount: number;
}

const spacetimeTypeLabels: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '中外文学对比',
  sameEra: '同代作者作品梳理',
  sameGenre: '同流派前后对比',
  custom: '自定义方案'
};

const spacetimeTypeDescriptions: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '选择一个文明或地域，与中国文学作品进行互文对比。',
  sameEra: '了解同一时代的其他作者与其代表作品，建立时间坐标。',
  sameGenre: '追踪同一流派在不同时期的传承与变化。',
  custom: '完全按你的想法组织分析结构，请在下方详细说明。'
};

const focusScopePlaceholder: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '例如：日本、伊斯兰世界、欧洲',
  sameEra: '例如：其他明末清初诗人',
  sameGenre: '例如：早期山水派 / 后期山水派',
  custom: '例如：跨媒体改编比较 / 主题与修辞对照'
};

const taskFeatureToTab: Record<SessionTaskFeature, FeatureKey> = {
  chat: 'chat',
  writing: 'writing',
  workshop: 'workshop',
  analysis: 'analysis',
  journey: 'journey',
  gallery: 'gallery'
};

const taskPlaceholders: Record<SessionTaskFeature, string> = {
  chat: '总结你在与作者交流中的问题、收获或新想法。',
  writing: '分享你写作的核心内容或心得。',
  workshop: '记录协作创作的亮点、共识或后续计划。',
  analysis: '写下你的分析要点、比较结果或课堂反思。',
  journey: '描述你对作者行迹的理解、疑问或课堂收获。',
  gallery: '写下你对作品的点评、灵感或改进建议。'
};

const StudentWorkspacePage = () => {
  const navigate = useNavigate();
  const { studentProfile, logoutStudent } = useAuthStore();
  const [activeFeature, setActiveFeature] = useState<FeatureKey>('chat');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingMessage, setPendingMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [imageForm, setImageForm] = useState({ style: '', sceneDescription: '' });
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [gallery, setGallery] = useState<StudentGalleryItem[]>([]);
  const [loadingImage, setLoadingImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<StudentGalleryItem | null>(null);
  const [selectedGalleryComments, setSelectedGalleryComments] = useState<GalleryComment[]>([]);
  const [galleryCommentsLoading, setGalleryCommentsLoading] = useState(false);
  const [galleryCommentInput, setGalleryCommentInput] = useState('');
  const [galleryCommentSubmitting, setGalleryCommentSubmitting] = useState(false);
  const [galleryLikeProcessing, setGalleryLikeProcessing] = useState<number | null>(null);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState<number | null>(null);
  const [taskResponses, setTaskResponses] = useState<Record<number, string>>({});
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [analysisRecords, setAnalysisRecords] = useState<StudentSpacetimeAnalysis[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisForm, setAnalysisForm] = useState({
    author: '',
    workTitle: '',
    era: '',
    genre: '',
    analysisType: 'crossCulture' as SpacetimeAnalysisType,
    focusScope: '',
    promptNotes: '',
    customInstruction: ''
  });
  const [editComparison, setEditComparison] = useState<{
    previous: ImageVersion;
    updated: GeneratedImage;
  } | null>(null);
  const [revertingEdit, setRevertingEdit] = useState(false);
  const [journeyData, setJourneyData] = useState<LifeJourneyResponse | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyLocation, setJourneyLocation] = useState<LifeJourneyLocation | null>(null);

  const editRemaining = useMemo(() => (generatedImage ? Math.max(0, 2 - generatedImage.editCount) : 2), [generatedImage]);
  const focusScopeHint = focusScopePlaceholder[analysisForm.analysisType];
  const analysisTypeHint = spacetimeTypeDescriptions[analysisForm.analysisType];

  const fetchGallery = useCallback(async () => {
    try {
      const response = await client.get('/student/gallery');
      const data = (response.data.gallery ?? []) as StudentGalleryItem[];
      setGallery(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchStudentTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const response = await client.get('/student/tasks');
      const data = (response.data.tasks ?? []) as StudentTask[];
      setTasks(data);
      setTaskResponses((prev) => {
        const next: Record<number, string> = {};
        data.forEach((task) => {
          const payload = task.submission?.payload as { text?: unknown } | undefined;
          if (payload && typeof payload.text === 'string') {
            next[task.taskId] = payload.text;
          } else if (prev[task.taskId]) {
            next[task.taskId] = prev[task.taskId];
          }
        });
        return next;
      });
    } catch (error) {
      console.error(error);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const fetchJourney = useCallback(
    async (silent = false) => {
      if (!silent) {
        setMessage(null);
      }
      setJourneyLoading(true);

      try {
        const response = await client.get('/student/life-journey');
        const journey = response.data.journey as LifeJourneyResponse;
        setJourneyData(journey);
        setJourneyLocation(journey.locations[0] ?? null);
        if (!silent) {
          setMessage('人生行迹已更新');
        }
      } catch (error) {
        console.error(error);
        setJourneyData(null);
        setJourneyLocation(null);
        if (error instanceof AxiosError && error.response?.data?.message) {
          setMessage(error.response.data.message);
        } else {
          setMessage('加载人生行迹失败，请稍后再试');
        }
      } finally {
        setJourneyLoading(false);
      }
    },
    []
  );

  const handleSubmitTask = useCallback(
    async (taskId: number, payload: Record<string, unknown>) => {
      setTaskSubmitting(taskId);
      try {
        await client.post(`/student/tasks/${taskId}/submission`, { payload });
        setMessage('任务提交成功');
        await fetchStudentTasks();
      } catch (error) {
        console.error(error);
        if (error instanceof AxiosError && error.response?.data?.message) {
          setMessage(error.response.data.message);
        } else {
          setMessage('任务提交失败，请稍后再试');
        }
      } finally {
        setTaskSubmitting(null);
      }
    },
    [fetchStudentTasks]
  );

  const handleTaskInputChange = (taskId: number, value: string) => {
    setTaskResponses((prev) => ({
      ...prev,
      [taskId]: value
    }));
  };

  const handleSubmitWritingTask = async (taskId: number) => {
    if (!generatedImage) {
      setMessage('请先完成一次描述性写作并生成图像');
      return;
    }

    const payload = {
      feature: 'writing' as SessionTaskFeature,
      imageId: generatedImage.imageId,
      sceneDescription: generatedImage.sceneDescription,
      style: generatedImage.style,
      submittedAt: new Date().toISOString()
    };

    await handleSubmitTask(taskId, payload);
  };

  const handleSubmitTaskText = async (task: StudentTask) => {
    const text = (taskResponses[task.taskId] ?? '').trim();
    if (!text) {
      setMessage('请先填写任务内容');
      return;
    }

    await handleSubmitTask(task.taskId, {
      feature: task.feature,
      text,
      submittedAt: new Date().toISOString()
    });
  };

  const renderTaskInputs = (feature: SessionTaskFeature) => {
    if (feature === 'writing' || feature === 'workshop') {
      return null;
    }

    const featureTasks = tasks.filter((task) => task.feature === feature);
    if (!tasksLoading && featureTasks.length === 0) {
      return null;
    }

    if (tasksLoading && featureTasks.length === 0) {
      return (
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 text-xs text-purple-600">
          正在加载任务，请稍候...
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm font-medium text-gray-700">课堂任务提交</div>
        {featureTasks.map((task) => {
          const value = taskResponses[task.taskId] ?? '';
          const isSubmitting = taskSubmitting === task.taskId;
          const completed = Boolean(task.submission);
          const statusLabel = completed
            ? task.submission?.status === 'resubmitted'
              ? '已重新提交'
              : '已提交'
            : task.isRequired
              ? '必做任务'
              : '可选任务';

          return (
            <div key={task.taskId} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{task.title}</span>
                <span>{statusLabel}</span>
              </div>
              {task.description ? <p className="text-xs text-gray-500">{task.description}</p> : null}
              <TextArea
                label="任务回答"
                placeholder={taskPlaceholders[feature]}
                value={value}
                onChange={(event) => handleTaskInputChange(task.taskId, event.target.value)}
                rows={4}
              />
              <div className="flex items-center gap-2">
                <GradientButton variant="primary" onClick={() => handleSubmitTaskText(task)} disabled={isSubmitting}>
                  {isSubmitting ? '提交中...' : completed ? '重新提交任务' : '提交任务'}
                </GradientButton>
                {completed && task.submission ? (
                  <span className="text-xs text-gray-400">
                    最近提交：{new Date(task.submission.updatedAt).toLocaleString('zh-CN')}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await client.get('/student/session');
        setSessionInfo(response.data.session);
      } catch (error) {
        console.error(error);
      }
    };

    const fetchChatHistory = async () => {
      try {
        const response = await client.get('/student/chat/history');
        setChatMessages(response.data.messages ?? []);
      } catch (error) {
        console.error(error);
      }
    };

    const fetchSpacetime = async () => {
      try {
        const response = await client.get('/student/spacetime');
        setAnalysisRecords(response.data.analyses ?? []);
      } catch (error) {
        console.error(error);
      }
    };

    fetchSession();
    fetchChatHistory();
    fetchGallery();
    fetchStudentTasks();
    fetchSpacetime();
  }, [fetchGallery, fetchStudentTasks]);

  useEffect(() => {
    if (!sessionInfo) {
      return;
    }

    setAnalysisForm((prev) => ({
      ...prev,
      author: prev.author || sessionInfo.authorName,
      workTitle: prev.workTitle || sessionInfo.literatureTitle
    }));
  }, [sessionInfo]);

  useEffect(() => {
    if (activeFeature === 'journey' && !journeyData && !journeyLoading) {
      fetchJourney(true);
    }
  }, [activeFeature, journeyData, journeyLoading, fetchJourney]);

  useEffect(() => {
    if (journeyData) {
      setJourneyLocation(journeyData.locations[0] ?? null);
    }
  }, [journeyData]);

  useEffect(() => {
    if (activeFeature === 'gallery') {
      fetchGallery();
    }
  }, [activeFeature, fetchGallery]);

  useEffect(() => {
    if (!selectedGalleryItem) {
      return;
    }
    const latest = gallery.find((item) => item.imageId === selectedGalleryItem.imageId);
    if (latest && (latest.likeCount !== selectedGalleryItem.likeCount || latest.commentCount !== selectedGalleryItem.commentCount)) {
      setSelectedGalleryItem(latest);
    }
  }, [gallery, selectedGalleryItem]);

  const handleSendMessage = async () => {
    if (!pendingMessage.trim()) return;
    setSending(true);
    setTyping(true);
    setMessage(null);

    try {
      const response = await client.post('/student/chat', { message: pendingMessage });
      setChatMessages((prev) => [...prev, ...response.data.messages]);
      setPendingMessage('');
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('发送失败，请稍后重试');
      }
    } finally {
      setSending(false);
      setTyping(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imageForm.style || !imageForm.sceneDescription) {
      setMessage('请填写完整的风格与场景描述');
      return;
    }

    if (generatedImage && generatedImage.editCount >= 2) {
      setMessage('编辑次数已达上限');
      return;
    }

    setLoadingImage(true);
    setMessage(null);

    try {
      const response = await client.post('/student/generate-image', imageForm);
      setGeneratedImage(response.data.image);
      setEditComparison(null);
      setMessage('图像生成完成');
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('生成失败，请稍后再试');
      }
    } finally {
      setLoadingImage(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!generatedImage || generatedImage.editCount >= 2) {
      if (generatedImage && generatedImage.editCount >= 2) {
        setMessage('编辑次数已达上限');
      }
      return;
    }

    setEditInstruction('');
    setMessage(null);
    setEditModalOpen(true);
  };

  const handleSubmitEdit = async () => {
    if (!generatedImage) return;
    if (!editInstruction.trim()) {
      setMessage('请输入希望编辑的内容');
      return;
    }

    setSubmittingEdit(true);
    setMessage(null);

    try {
      const response = await client.post(`/student/images/${generatedImage.imageId}/edit`, { instruction: editInstruction });
      const updatedImage = response.data.image as GeneratedImage;
      const previousImage = response.data.previousImage as ImageVersion | undefined;
      setGeneratedImage(updatedImage);
      if (previousImage) {
        setEditComparison({ previous: previousImage, updated: updatedImage });
      }
      setMessage('图像已根据编辑指令更新，请确认是否保留。');
      setEditModalOpen(false);
      setEditInstruction('');

      if (updatedImage.isShared) {
        await fetchGallery();
      }
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('编辑失败，请稍后再试');
      }
    } finally {
      setSubmittingEdit(false);
    }
  };

  const closeEditModal = () => {
    if (submittingEdit) return;
    setEditModalOpen(false);
    setEditInstruction('');
    setMessage(null);
  };

  const handleShareImage = async () => {
    if (!generatedImage) return;

    try {
      await client.post(`/student/images/${generatedImage.imageId}/share`);
      setGeneratedImage({ ...generatedImage, isShared: true });
      setMessage('作品已分享到课堂画廊');
      await fetchGallery();
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('分享失败，请稍后再试');
      }
    }
  };

  const handleGenerateAnalysis = async () => {
    const author = analysisForm.author.trim();
    const workTitle = analysisForm.workTitle.trim();
    const era = analysisForm.era.trim();
    const genre = analysisForm.genre.trim();
    const focusScope = analysisForm.focusScope.trim();
    const promptNotes = analysisForm.promptNotes.trim();
    const customInstruction = analysisForm.customInstruction.trim();

    if (analysisForm.analysisType !== 'custom' && (!author || !workTitle || !era || !genre)) {
      setMessage('请完整填写作者、作品、时代与流派信息');
      return;
    }

    if (analysisForm.analysisType === 'custom' && customInstruction.length === 0) {
      setMessage('请详细描述自定义分析的要求');
      return;
    }

    setAnalysisLoading(true);
    setMessage(null);

    try {
      const payload = {
        author,
        workTitle,
        era,
        genre,
        analysisType: analysisForm.analysisType,
        focusScope: focusScope.length > 0 ? focusScope : undefined,
        promptNotes: promptNotes.length > 0 ? promptNotes : undefined,
        customInstruction: customInstruction.length > 0 ? customInstruction : undefined
      };

      const response = await client.post('/student/spacetime', payload);
      const analysis = response.data.analysis as StudentSpacetimeAnalysis;
      setAnalysisRecords((prev) => [analysis, ...prev]);
      setMessage('对比分析已生成');
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('生成失败，请稍后再试');
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleDownloadAnalysis = (analysis: StudentSpacetimeAnalysis) => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const detailRows: Array<{ label: string; value?: string | null }> = [
      { label: '分析方向', value: spacetimeTypeLabels[analysis.analysisType] },
      { label: '作者', value: analysis.author },
      { label: '作品', value: analysis.workTitle },
      { label: '时代', value: analysis.era },
      { label: '流派', value: analysis.genre },
      { label: '聚焦范围', value: analysis.focusScope },
      { label: '学生补充', value: analysis.promptNotes },
      { label: '自定义指令', value: analysis.customInstruction }
    ];

    const detailHtml = detailRows
      .filter((row) => row.value && row.value.trim().length > 0)
      .map(
        (row) => `
          <tr>
            <th>${escapeHtml(row.label)}</th>
            <td>${escapeHtml(row.value ?? '')}</td>
          </tr>`
      )
      .join('\n');

    const sections = analysis.generatedContent
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`) // preserve line breaks
      .join('\n');

    const timestamp = new Date(analysis.createdAt).toLocaleString('zh-CN');
    const safeAuthor = analysis.author.replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]+/g, '');
    const fileStamp = new Date(analysis.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>对比分析：${escapeHtml(analysis.author)}《${escapeHtml(analysis.workTitle)}》</title>
    <style>
      body { font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif; margin: 40px; color: #1f2937; }
      header { text-align: center; margin-bottom: 32px; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      time { color: #6b7280; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
      th { text-align: left; width: 120px; color: #4b5563; padding: 6px 0; }
      td { padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
      section { page-break-inside: avoid; }
      p { line-height: 1.7; margin: 14px 0; }
      blockquote { border-left: 4px solid #c4b5fd; padding: 0 16px; color: #4c1d95; }
      @media print {
        body { margin: 20px 32px; }
        header { margin-bottom: 16px; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>对比分析提纲</h1>
      <time>生成时间：${escapeHtml(timestamp)}</time>
    </header>
    <section>
      <table>
        ${detailHtml}
      </table>
    </section>
    <section>
      ${sections}
    </section>
  </body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `对比分析-${safeAuthor || '自定义'}-${fileStamp}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadGalleryComments = useCallback(async (imageId: number) => {
    setGalleryCommentsLoading(true);
    try {
      const response = await client.get(`/student/gallery/${imageId}/comments`);
      const comments = (response.data.comments ?? []) as GalleryComment[];
      const recent = comments.slice(-3);
      setSelectedGalleryComments(comments);
      setGallery((prev) =>
        prev.map((item) =>
          item.imageId === imageId
            ? { ...item, commentCount: comments.length, recentComments: recent }
            : item
        )
      );
      setSelectedGalleryItem((prev) =>
        prev && prev.imageId === imageId
          ? { ...prev, commentCount: comments.length, recentComments: recent }
          : prev
      );
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('加载评论失败，请稍后再试');
      }
    } finally {
      setGalleryCommentsLoading(false);
    }
  }, [setMessage]);

  const handleGalleryItemClick = (item: StudentGalleryItem) => {
    setSelectedGalleryItem(item);
    setGalleryCommentInput('');
    setSelectedGalleryComments([...(item.recentComments ?? [])]);
    loadGalleryComments(item.imageId);
  };

  const handleKeepEditedImage = () => {
    setEditComparison(null);
    setMessage('已保留当前版本');
  };

  const handleDiscardEditedImage = async () => {
    if (!editComparison || !generatedImage) {
      return;
    }
    setRevertingEdit(true);
    setMessage(null);

    try {
      const response = await client.post(`/student/images/${generatedImage.imageId}/revert`, {
        previousImageUrl: editComparison.previous.imageUrl,
        previousSceneDescription: editComparison.previous.sceneDescription,
        previousStyle: editComparison.previous.style,
        previousEditCount: editComparison.previous.editCount,
        currentImageUrl: editComparison.updated.imageUrl
      });
      const revertedImage = response.data.image as GeneratedImage;
      setGeneratedImage(revertedImage);
      setEditComparison(null);
      setMessage('已恢复为编辑前的版本');
      if (revertedImage.isShared) {
        await fetchGallery();
      }
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('撤销失败，请稍后再试');
      }
    } finally {
      setRevertingEdit(false);
    }
  };

  const handleToggleGalleryLike = async (imageId: number) => {
    setGalleryLikeProcessing(imageId);
    try {
      const response = await client.post(`/student/gallery/${imageId}/like`);
      const result = response.data as { liked: boolean; likeCount: number };
      setGallery((prev) =>
        prev.map((item) =>
          item.imageId === imageId
            ? { ...item, likedByMe: result.liked, likeCount: result.likeCount }
            : item
        )
      );
      setSelectedGalleryItem((prev) =>
        prev && prev.imageId === imageId
          ? { ...prev, likedByMe: result.liked, likeCount: result.likeCount }
          : prev
      );
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('点赞失败，请稍后再试');
      }
    } finally {
      setGalleryLikeProcessing(null);
    }
  };

  const handleSubmitGalleryComment = async () => {
    if (!selectedGalleryItem) {
      return;
    }

    const content = galleryCommentInput.trim();
    if (!content) {
      setMessage('请输入评论内容');
      return;
    }

    setGalleryCommentSubmitting(true);
    try {
      const response = await client.post(`/student/gallery/${selectedGalleryItem.imageId}/comments`, {
        content
      });
      const { comment, commentCount } = response.data as { comment: GalleryComment; commentCount: number };
      setSelectedGalleryComments((prev) => [...prev, comment]);
      setGallery((prev) =>
        prev.map((item) =>
          item.imageId === selectedGalleryItem.imageId
            ? {
                ...item,
                commentCount,
                recentComments: [...item.recentComments, comment].slice(-3)
              }
            : item
        )
      );
      setSelectedGalleryItem((prev) =>
        prev && prev.imageId === selectedGalleryItem.imageId
          ? {
              ...prev,
              commentCount,
              recentComments: [...prev.recentComments, comment].slice(-3)
            }
          : prev
      );
      setGalleryCommentInput('');
      setMessage('评论已发布');
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('发布评论失败，请稍后再试');
      }
    } finally {
      setGalleryCommentSubmitting(false);
    }
  };

  const closeGalleryPreview = () => {
    setSelectedGalleryItem(null);
    setSelectedGalleryComments([]);
    setGalleryCommentInput('');
    setGalleryLikeProcessing(null);
    setGalleryCommentsLoading(false);
  };

  const goToFeature = (feature: SessionTaskFeature) => {
    const target = taskFeatureToTab[feature];
    setActiveFeature(target);
  };

  const handleLogout = () => {
    logoutStudent();
    navigate('/student-login');
  };

  const featureButtons = [
    { key: 'chat' as FeatureKey, label: '与作者对话', variant: 'primary' as const },
    { key: 'writing' as FeatureKey, label: '描述性写作', variant: 'secondary' as const },
    { key: 'analysis' as FeatureKey, label: '对比分析', variant: 'quaternary' as const },
    { key: 'journey' as FeatureKey, label: '人生行迹', variant: 'secondary' as const },
    { key: 'workshop' as FeatureKey, label: '协作创作', variant: 'secondary' as const },
    { key: 'gallery' as FeatureKey, label: '课堂画廊', variant: 'tertiary' as const }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{sessionInfo?.sessionName ?? '未命名课堂'}</p>
            <h1 className="text-lg font-semibold text-gray-900">学生学习界面</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">用户：{studentProfile?.username}</p>
            <GradientButton variant="secondary" className="mt-2" onClick={handleLogout}>
              退出课堂
            </GradientButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="grid gap-3 md:grid-cols-3">
          {featureButtons.map((button) => (
            <FeatureButton
              key={button.key}
              variant={button.variant}
              active={activeFeature === button.key}
              onClick={() => setActiveFeature(button.key)}
            >
              {button.label}
            </FeatureButton>
          ))}
        </section>

        {message ? <p className="mt-4 text-center text-sm text-lavender-600">{message}</p> : null}

        {(tasksLoading || tasks.length > 0) ? (
          <Card className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">课堂任务清单</h2>
                <p className="text-xs text-gray-500">完成指定功能后记得提交成果</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setTasksExpanded((prev) => !prev)}
                  className="rounded border border-gray-200 px-2 py-1 text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  {tasksExpanded ? '收起' : '展开'}
                </button>
                <button
                  type="button"
                  onClick={() => fetchStudentTasks()}
                  className="text-lavender-600 transition hover:text-lavender-700"
                >
                  刷新
                </button>
              </div>
            </div>
            {tasksLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                正在获取任务，请稍候...
              </div>
            ) : !tasksExpanded ? (
              <p className="text-sm text-gray-500">任务清单已收起，点击“展开”查看详情。</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500">暂无教师布置的任务。</p>
            ) : (
              <ul className="space-y-3">
                {tasks.map((task) => {
                  const completed = Boolean(task.submission);
                  const statusLabel = completed
                    ? task.submission?.status === 'resubmitted'
                      ? '已重新提交'
                      : '已提交'
                    : task.isRequired
                      ? '待完成'
                      : '可选任务';
                  const statusClass = completed ? 'text-lavender-600' : task.isRequired ? 'text-gray-700' : 'text-gray-400';
                  return (
                    <li key={task.taskId} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                          {task.description ? <p className="text-xs text-gray-500">{task.description}</p> : null}
                        </div>
                        <span className={`text-xs font-medium ${statusClass}`}>{statusLabel}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <GradientButton
                          variant="secondary"
                          onClick={() => goToFeature(task.feature)}
                        >
                          前往完成
                        </GradientButton>
                        {task.feature === 'writing' ? (
                          <GradientButton
                            variant="primary"
                            onClick={() => handleSubmitWritingTask(task.taskId)}
                            disabled={taskSubmitting === task.taskId}
                          >
                            {taskSubmitting === task.taskId ? '提交中...' : completed ? '重新提交成果' : '提交写作成果'}
                          </GradientButton>
                        ) : task.feature === 'workshop' ? (
                          <span className="text-gray-500">请在协作创作面板中提交成果</span>
                        ) : null}
                        {completed && task.submission ? (
                          <span className="text-gray-400">
                            最近提交：{new Date(task.submission.updatedAt).toLocaleString('zh-CN')}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : null}

        <section className="mt-6">
          {activeFeature === 'chat' ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">与作者对话</h2>
                  <p className="text-xs text-gray-500">
                    当前作者：{sessionInfo?.authorName}，《{sessionInfo?.literatureTitle}》
                  </p>
                </div>
                {typing ? <span className="text-sm text-lavender-600">作者正在思考...</span> : null}
              </div>
              <div className="max-h-[420px] overflow-y-auto rounded-lg bg-gray-50 p-4">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">开始提问，与作者开启一场文学对话。</p>
                ) : (
                  chatMessages.map((messageItem) => (
                    <ChatBubble key={messageItem.messageId} sender={messageItem.senderType} content={messageItem.content} />
                  ))
                )}
              </div>
              <div className="space-y-3">
                <TextArea
                  label="输入你的问题或想法"
                  placeholder="请结合作品内容与作者交流"
                  value={pendingMessage}
                  onChange={(e) => setPendingMessage(e.target.value)}
                  rows={3}
                />
                <GradientButton variant="primary" onClick={handleSendMessage} disabled={sending}>
                  {sending ? '发送中...' : '发送'}
                </GradientButton>
              </div>
              {renderTaskInputs('chat')}
            </Card>
          ) : null}

          {activeFeature === 'writing' ? (
            <Card className="space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-gray-900">描述性写作 - 用文字描绘你的想象</h2>
                <p className="text-xs text-gray-500">详细描述场景，生成符合想象的图像。</p>
              </header>
              <div className="space-y-4">
                <TextInput
                  label="图像风格"
                  placeholder="例如：水墨画、油画、写实主义"
                  value={imageForm.style}
                  onChange={(e) => setImageForm((prev) => ({ ...prev, style: e.target.value }))}
                />
                <TextArea
                  label="场景描述"
                  hint="提示：详细描述人物、环境、氛围、色彩、动作等元素"
                  value={imageForm.sceneDescription}
                  onChange={(e) => setImageForm((prev) => ({ ...prev, sceneDescription: e.target.value }))}
                  rows={6}
                />
                <GradientButton variant="secondary" onClick={handleGenerateImage} disabled={loadingImage}>
                  {loadingImage ? '生成中...' : '生成图像'}
                </GradientButton>
              </div>

              {generatedImage ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <img src={generatedImage.imageUrl} alt={generatedImage.sceneDescription} className="mx-auto max-h-80 rounded-lg object-contain" />
                  <div className="mt-4 space-y-2 text-sm">
                    <p>风格：{generatedImage.style}</p>
                    <p className="whitespace-pre-line">场景：{generatedImage.sceneDescription}</p>
                    <p>剩余编辑次数：{editRemaining}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <GradientButton
                      variant="primary"
                      disabled={loadingImage || generatedImage.editCount >= 2}
                      onClick={handleOpenEditModal}
                    >
                      继续编辑图像
                    </GradientButton>
                    <GradientButton
                      variant="secondary"
                      onClick={() => {
                        setImageForm({ style: generatedImage.style, sceneDescription: generatedImage.sceneDescription });
                        setActiveFeature('writing');
                      }}
                    >
                      调整描述重新生成
                    </GradientButton>
                    <GradientButton
                      variant="tertiary"
                      disabled={generatedImage.isShared}
                      onClick={handleShareImage}
                    >
                      {generatedImage.isShared ? '已分享到画廊' : '分享到课堂画廊'}
                    </GradientButton>
                  </div>
                </div>
              ) : null}

              {editComparison ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="text-base font-semibold text-gray-900">版本对比</h3>
                  <p className="mt-1 text-xs text-gray-500">对比编辑前后的效果，确认是否保留新的版本。</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">编辑前</span>
                      <img
                        src={editComparison.previous.imageUrl}
                        alt={editComparison.previous.sceneDescription}
                        className="h-60 w-full rounded-lg object-contain"
                      />
                      <p className="text-xs text-gray-500">编辑次数：{editComparison.previous.editCount}</p>
                      <p className="text-xs text-gray-500">描述：{editComparison.previous.sceneDescription}</p>
                    </div>
                    <div className="space-y-2 rounded-lg border border-lavender-200 bg-lavender-50 p-3">
                      <span className="inline-flex items-center rounded-full bg-lavender-100 px-2 py-0.5 text-xs text-lavender-700">编辑后</span>
                      <img
                        src={editComparison.updated.imageUrl}
                        alt={editComparison.updated.sceneDescription}
                        className="h-60 w-full rounded-lg object-contain"
                      />
                      <p className="text-xs text-gray-500">编辑次数：{editComparison.updated.editCount}</p>
                      <p className="text-xs text-gray-500">描述：{editComparison.updated.sceneDescription}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <GradientButton variant="primary" onClick={handleKeepEditedImage} disabled={revertingEdit}>
                      保留此版本
                    </GradientButton>
                    <GradientButton variant="secondary" onClick={handleDiscardEditedImage} disabled={revertingEdit}>
                      {revertingEdit ? '撤销中...' : '放弃此次编辑'}
                    </GradientButton>
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          {activeFeature === 'journey' ? (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">人生行迹 - {journeyData?.heroName ?? sessionInfo?.authorName ?? '主角'}</h2>
                  <p className="text-xs text-gray-500">结合课堂人物自动生成的行迹地图，点击地点查看详细信息。</p>
                </div>
                <GradientButton variant="primary" onClick={() => fetchJourney()} disabled={journeyLoading}>
                  {journeyLoading ? '加载中...' : journeyData ? '刷新行迹' : '加载行迹'}
                </GradientButton>
              </div>

              {journeyLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-gray-500">
                  <span className="inline-flex h-10 w-10 animate-spin rounded-full border-2 border-lavender-200 border-t-lavender-600" />
                  正在构建人生行迹，请稍候…
                </div>
              ) : journeyData ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                    <div className="h-[520px] overflow-hidden rounded-lg border border-gray-200">
                      <LifeJourneyMap locations={journeyData.locations} onSelect={setJourneyLocation} />
                    </div>
                    <aside className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      {(() => {
                        const current = journeyLocation ?? journeyData.locations[0];
                        if (!current) {
                          return <p className="text-sm text-gray-500">暂未找到行迹数据。</p>;
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
                                生平事迹
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
                                <div key={index} className="rounded-lg bg-lavender-50 p-3 text-sm text-gray-700">
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
                <p className="text-sm text-gray-500">点击“生成行迹”即可查看本节作者的互动式人生地图。</p>
              )}
              {renderTaskInputs('journey')}
            </Card>
          ) : null}

          {activeFeature === 'workshop' ? (
            <WorkshopPanel
              tasks={tasks}
              onSubmitTask={handleSubmitTask}
              submittingTaskId={taskSubmitting}
            />
          ) : null}

          {activeFeature === 'analysis' ? (
            <Card className="space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-gray-900">对比分析 - 建立多维文学坐标</h2>
                <p className="text-xs text-gray-500">结合课堂主题，生成时代、流派、跨文化或自定义的分析提纲。</p>
                <div className="mt-3">
                  <GradientButton
                    variant="secondary"
                    onClick={() =>
                      setAnalysisForm((prev) => ({
                        ...prev,
                        analysisType: 'custom',
                        customInstruction: prev.customInstruction || '请在此填写你希望生成的分析结构与重点。'
                      }))
                    }
                    className="text-sm"
                  >
                    自定义方案
                  </GradientButton>
                </div>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="作者"
                  placeholder="例如：杜甫"
                  value={analysisForm.author}
                  onChange={(e) => setAnalysisForm((prev) => ({ ...prev, author: e.target.value }))}
                />
                <TextInput
                  label="作品"
                  placeholder="例如：《春望》"
                  value={analysisForm.workTitle}
                  onChange={(e) => setAnalysisForm((prev) => ({ ...prev, workTitle: e.target.value }))}
                />
                <TextInput
                  label="时代"
                  placeholder="例如：唐代"
                  value={analysisForm.era}
                  onChange={(e) => setAnalysisForm((prev) => ({ ...prev, era: e.target.value }))}
                />
                <TextInput
                  label="流派"
                  placeholder="例如：现实主义诗歌"
                  value={analysisForm.genre}
                  onChange={(e) => setAnalysisForm((prev) => ({ ...prev, genre: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                  <span>分析方向</span>
                  <select
                    value={analysisForm.analysisType}
                    onChange={(e) => {
                      const nextType = e.target.value as SpacetimeAnalysisType;
                      setAnalysisForm((prev) => ({
                        ...prev,
                        analysisType: nextType,
                        customInstruction: nextType === 'custom' ? prev.customInstruction : ''
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-lavender-400 focus:outline-none focus:ring-1 focus:ring-lavender-400"
                  >
                    {Object.entries(spacetimeTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">{analysisTypeHint}</span>
                </label>
                <TextInput
                  label="对比 / 聚焦范围（选填）"
                  placeholder={focusScopeHint}
                  hint={`提示：${focusScopeHint}`}
                  value={analysisForm.focusScope}
                  onChange={(e) => setAnalysisForm((prev) => ({ ...prev, focusScope: e.target.value }))}
                />
              </div>
              <TextArea
                label="补充说明（选填）"
                hint="可以写下你最关注的角度、课堂讨论问题或阅读延伸。"
                value={analysisForm.promptNotes}
                onChange={(e) => setAnalysisForm((prev) => ({ ...prev, promptNotes: e.target.value }))}
                rows={4}
              />
              {analysisForm.analysisType === 'custom' ? (
                <TextArea
                  label="自定义分析要求"
                  hint="详细描述你希望老师生成的结构、角度或任何特别指令。"
                  value={analysisForm.customInstruction}
                  onChange={(e) => setAnalysisForm((prev) => ({ ...prev, customInstruction: e.target.value }))}
                  rows={6}
                />
              ) : null}
              <GradientButton variant="primary" onClick={handleGenerateAnalysis} disabled={analysisLoading}>
                {analysisLoading ? '生成中...' : '生成分析提纲'}
              </GradientButton>
              {renderTaskInputs('analysis')}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">历史记录</h3>
                {analysisRecords.length === 0 ? (
                  <p className="text-sm text-gray-500">还没有生成记录，试着先创建一份对比分析。</p>
                ) : (
                  <ul className="space-y-3">
                    {analysisRecords.map((analysis) => (
                      <li
                        key={analysis.analysisId}
                        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center rounded-full bg-lavender-100 px-2 py-0.5 text-lavender-600">
                            {spacetimeTypeLabels[analysis.analysisType]}
                          </span>
                          <span>{new Date(analysis.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-700">
                          <p>
                            <span className="font-medium">作者：</span>
                            {analysis.author}
                            <span className="mx-2 text-gray-400">·</span>
                            <span className="font-medium">作品：</span>
                            {analysis.workTitle}
                          </p>
                          <p>
                            <span className="font-medium">时代：</span>
                            {analysis.era}
                            <span className="mx-2 text-gray-400">·</span>
                            <span className="font-medium">流派：</span>
                            {analysis.genre}
                          </p>
                          {analysis.focusScope ? (
                            <p>
                              <span className="font-medium">聚焦：</span>
                              {analysis.focusScope}
                            </p>
                          ) : null}
                          {analysis.customInstruction ? (
                            <p className="text-xs text-lavender-600">自定义指令：{analysis.customInstruction}</p>
                          ) : null}
                          {analysis.promptNotes ? (
                            <p className="text-xs text-gray-500">学生补充：{analysis.promptNotes}</p>
                          ) : null}
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                          <MarkdownRenderer content={analysis.generatedContent} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          {analysis.customInstruction ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-lavender-50 px-2 py-0.5 text-lavender-600">
                              自定义指令
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDownloadAnalysis(analysis)}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 transition hover:border-lavender-300 hover:text-lavender-600 hover:bg-lavender-50"
                          >
                            下载
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}

          {activeFeature === 'gallery' ? (
            <Card className="space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-gray-900">课堂画廊 - 本节课学生作品展示</h2>
                <p className="text-xs text-gray-500">欣赏同学们的创作灵感，点击查看详情。</p>
              </header>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {gallery.map((item) => (
                  <button
                    type="button"
                    key={item.imageId}
                    onClick={() => handleGalleryItemClick(item)}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-lavender-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-lavender-300"
                  >
                    <img src={item.imageUrl} alt={item.sceneDescription} className="h-32 w-full object-cover" />
                    <div className="space-y-2 px-4 py-3 text-sm">
                      <div className="space-y-1">
                        <p className="font-semibold text-gray-800">作者：{item.username}</p>
                        <p className="text-gray-600">风格：{item.style}</p>
                        <p className="truncate text-gray-500">{item.sceneDescription}</p>
                      </div>
                      {item.recentComments.length > 0 ? (
                        <div className="space-y-1 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                          {item.recentComments.map((comment) => (
                            <p key={comment.commentId} className="line-clamp-2">
                              <span className="font-medium text-gray-700">{comment.username}：</span>
                              {comment.content}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>👍 {item.likeCount}</span>
                        <span>💬 {item.commentCount}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {gallery.length === 0 ? <p className="text-sm text-gray-500">尚无作品分享，快来成为第一个!</p> : null}
              </div>
              {renderTaskInputs('gallery')}
            </Card>
          ) : null}
        </section>
      </main>
      {editModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeEditModal}>
          <div
            className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">继续编辑图像</h3>
            <p className="mt-2 text-sm text-gray-600">描述你想要修改的细节，我们会在当前图像基础上进行更新。</p>
            <div className="mt-4">
              <TextArea
                label="编辑指令"
                placeholder="例如：让人物的衣袍更飘逸，并加入夜色灯光。"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                rows={4}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <GradientButton variant="secondary" onClick={closeEditModal} disabled={submittingEdit}>
                取消
              </GradientButton>
              <GradientButton variant="primary" onClick={handleSubmitEdit} disabled={submittingEdit}>
                {submittingEdit ? '编辑中...' : '提交编辑'}
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}

      {selectedGalleryItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4" onClick={closeGalleryPreview}>
          <div
            className="w-full max-w-4xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid gap-6 p-6 md:grid-cols-2">
              <img
                src={selectedGalleryItem.imageUrl}
                alt={selectedGalleryItem.sceneDescription}
                className="w-full rounded-2xl object-contain"
              />
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <p className="text-base font-semibold text-gray-900">{selectedGalleryItem.username} 的创作</p>
                  <p className="mt-1 text-gray-500">风格：{selectedGalleryItem.style}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-500">场景描述</p>
                  <p className="mt-2 whitespace-pre-line text-gray-700">{selectedGalleryItem.sceneDescription}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => handleToggleGalleryLike(selectedGalleryItem.imageId)}
                    disabled={galleryLikeProcessing === selectedGalleryItem.imageId}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition ${
                      selectedGalleryItem.likedByMe ? 'bg-lavender-100 text-lavender-600' : 'border border-lavender-200 text-lavender-600 hover:bg-lavender-50'
                    } ${galleryLikeProcessing === selectedGalleryItem.imageId ? 'opacity-70' : ''}`}
                  >
                    {selectedGalleryItem.likedByMe ? '❤️ 已点赞' : '👍 点赞'}
                    <span className="text-xs text-lavender-500">{selectedGalleryItem.likeCount}</span>
                  </button>
                  <span>共 {selectedGalleryItem.commentCount} 条评论</span>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">评论区</h4>
                    {galleryCommentsLoading ? <span className="text-xs text-gray-400">加载中...</span> : null}
                  </div>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {selectedGalleryComments.length === 0 ? (
                      <p className="text-xs text-gray-400">暂时还没有评论，欢迎留下你对作品的想法。</p>
                    ) : (
                      selectedGalleryComments.map((comment) => (
                        <div key={comment.commentId} className="rounded-lg bg-gray-50 p-2">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{comment.username}</span>
                            <span>{new Date(comment.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-700">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    <TextArea
                      label="发表新评论"
                      value={galleryCommentInput}
                      onChange={(event) => setGalleryCommentInput(event.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <GradientButton
                        variant="primary"
                        onClick={handleSubmitGalleryComment}
                        disabled={galleryCommentSubmitting || !selectedGalleryItem}
                      >
                        {galleryCommentSubmitting ? '发布中...' : '发布评论'}
                      </GradientButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-4">
              <GradientButton variant="secondary" onClick={closeGalleryPreview}>
                关闭
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default StudentWorkspacePage;
