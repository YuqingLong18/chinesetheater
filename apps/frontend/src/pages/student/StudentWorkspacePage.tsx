import { useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import GradientButton from '../../components/GradientButton';
import FeatureButton from '../../components/FeatureButton';
import TextArea from '../../components/TextArea';
import TextInput from '../../components/TextInput';
import ChatBubble from '../../components/ChatBubble';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { StudentGalleryItem, StudentSpacetimeAnalysis, SpacetimeAnalysisType } from '../../types';

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

type FeatureKey = 'chat' | 'writing' | 'spacetime' | 'gallery';

const spacetimeTypeLabels: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '中外文学对比',
  sameEra: '同代作者作品梳理',
  sameGenre: '同流派前后对比'
};

const spacetimeTypeDescriptions: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '选择一个文明或地域，与中国文学作品进行互文对比。',
  sameEra: '了解同一时代的其他作者与其代表作品，建立时间坐标。',
  sameGenre: '追踪同一流派在不同时期的传承与变化。'
};

const focusScopePlaceholder: Record<SpacetimeAnalysisType, string> = {
  crossCulture: '例如：日本、伊斯兰世界、欧洲',
  sameEra: '例如：其他明末清初诗人',
  sameGenre: '例如：早期山水派 / 后期山水派'
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
  const [spacetimeAnalyses, setSpacetimeAnalyses] = useState<StudentSpacetimeAnalysis[]>([]);
  const [spacetimeLoading, setSpacetimeLoading] = useState(false);
  const [spacetimeForm, setSpacetimeForm] = useState({
    author: '',
    workTitle: '',
    era: '',
    genre: '',
    analysisType: 'crossCulture' as SpacetimeAnalysisType,
    focusScope: '',
    promptNotes: ''
  });

  const editRemaining = useMemo(() => (generatedImage ? Math.max(0, 2 - generatedImage.editCount) : 2), [generatedImage]);
  const focusScopeHint = focusScopePlaceholder[spacetimeForm.analysisType];
  const analysisTypeHint = spacetimeTypeDescriptions[spacetimeForm.analysisType];

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

    const fetchGallery = async () => {
      try {
        const response = await client.get('/student/gallery');
        setGallery(response.data.gallery ?? []);
      } catch (error) {
        console.error(error);
      }
    };

    const fetchSpacetime = async () => {
      try {
        const response = await client.get('/student/spacetime');
        setSpacetimeAnalyses(response.data.analyses ?? []);
      } catch (error) {
        console.error(error);
      }
    };

    fetchSession();
    fetchChatHistory();
    fetchGallery();
    fetchSpacetime();
  }, []);

  useEffect(() => {
    if (!sessionInfo) {
      return;
    }

    setSpacetimeForm((prev) => ({
      ...prev,
      author: prev.author || sessionInfo.authorName,
      workTitle: prev.workTitle || sessionInfo.literatureTitle
    }));
  }, [sessionInfo]);

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
      setGeneratedImage(updatedImage);
      setMessage('图像已根据编辑指令更新');
      setEditModalOpen(false);
      setEditInstruction('');

      if (updatedImage.isShared) {
        const galleryResponse = await client.get('/student/gallery');
        setGallery(galleryResponse.data.gallery ?? []);
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
      const response = await client.get('/student/gallery');
      setGallery(response.data.gallery ?? []);
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('分享失败，请稍后再试');
      }
    }
  };

  const handleGenerateSpacetime = async () => {
    const author = spacetimeForm.author.trim();
    const workTitle = spacetimeForm.workTitle.trim();
    const era = spacetimeForm.era.trim();
    const genre = spacetimeForm.genre.trim();
    const focusScope = spacetimeForm.focusScope.trim();
    const promptNotes = spacetimeForm.promptNotes.trim();

    if (!author || !workTitle || !era || !genre) {
      setMessage('请完整填写作者、作品、时代与流派信息');
      return;
    }

    setSpacetimeLoading(true);
    setMessage(null);

    try {
      const payload = {
        author,
        workTitle,
        era,
        genre,
        analysisType: spacetimeForm.analysisType,
        focusScope: focusScope.length > 0 ? focusScope : undefined,
        promptNotes: promptNotes.length > 0 ? promptNotes : undefined
      };

      const response = await client.post('/student/spacetime', payload);
      const analysis = response.data.analysis as StudentSpacetimeAnalysis;
      setSpacetimeAnalyses((prev) => [analysis, ...prev]);
      setMessage('构建时空分析已生成');
    } catch (error) {
      console.error(error);
      if (error instanceof AxiosError && error.response?.data?.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage('生成失败，请稍后再试');
      }
    } finally {
      setSpacetimeLoading(false);
    }
  };

  const handleGalleryItemClick = (item: StudentGalleryItem) => {
    setSelectedGalleryItem(item);
  };

  const closeGalleryPreview = () => {
    setSelectedGalleryItem(null);
  };

  const handleLogout = () => {
    logoutStudent();
    navigate('/student-login');
  };

  const featureButtons = [
    { key: 'chat' as FeatureKey, label: '与作者对话', variant: 'primary' as const },
    { key: 'writing' as FeatureKey, label: '描述性写作', variant: 'secondary' as const },
    { key: 'spacetime' as FeatureKey, label: '构建时空', variant: 'quaternary' as const },
    { key: 'gallery' as FeatureKey, label: '课堂画廊', variant: 'tertiary' as const }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm text-gray-500">{sessionInfo?.sessionName ?? '未命名课堂'}</p>
          <h1 className="text-xl font-semibold text-gray-900">学生学习界面</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">用户：{studentProfile?.username}</p>
          <GradientButton variant="secondary" className="mt-2" onClick={handleLogout}>
            退出课堂
          </GradientButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="grid gap-6 md:grid-cols-3">
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

        {message ? <p className="mt-4 text-center text-sm text-blue-600">{message}</p> : null}

        <section className="mt-6">
          {activeFeature === 'chat' ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">与作者对话</h2>
                  <p className="text-sm text-gray-500">
                    当前作者：{sessionInfo?.authorName}，《{sessionInfo?.literatureTitle}》
                  </p>
                </div>
                {typing ? <span className="text-sm text-purple-500">作者正在思考...</span> : null}
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
            </Card>
          ) : null}

          {activeFeature === 'writing' ? (
            <Card className="space-y-4">
              <header>
                <h2 className="text-xl font-semibold text-gray-900">描述性写作 - 用文字描绘你的想象</h2>
                <p className="text-sm text-gray-500">详细描述场景，生成符合想象的图像。</p>
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
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
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
            </Card>
          ) : null}

          {activeFeature === 'spacetime' ? (
            <Card className="space-y-5">
              <header>
                <h2 className="text-xl font-semibold text-gray-900">构建时空 - 建立文学坐标</h2>
                <p className="text-sm text-gray-500">结合课堂主题，生成时代、流派与跨文化的分析提纲。</p>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="作者"
                  placeholder="例如：杜甫"
                  value={spacetimeForm.author}
                  onChange={(e) => setSpacetimeForm((prev) => ({ ...prev, author: e.target.value }))}
                />
                <TextInput
                  label="作品"
                  placeholder="例如：《春望》"
                  value={spacetimeForm.workTitle}
                  onChange={(e) => setSpacetimeForm((prev) => ({ ...prev, workTitle: e.target.value }))}
                />
                <TextInput
                  label="时代"
                  placeholder="例如：唐代"
                  value={spacetimeForm.era}
                  onChange={(e) => setSpacetimeForm((prev) => ({ ...prev, era: e.target.value }))}
                />
                <TextInput
                  label="流派"
                  placeholder="例如：现实主义诗歌"
                  value={spacetimeForm.genre}
                  onChange={(e) => setSpacetimeForm((prev) => ({ ...prev, genre: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                  <span>分析方向</span>
                  <select
                    value={spacetimeForm.analysisType}
                    onChange={(e) =>
                      setSpacetimeForm((prev) => ({
                        ...prev,
                        analysisType: e.target.value as SpacetimeAnalysisType
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  value={spacetimeForm.focusScope}
                  onChange={(e) => setSpacetimeForm((prev) => ({ ...prev, focusScope: e.target.value }))}
                />
              </div>
              <TextArea
                label="补充说明（选填）"
                hint="可以写下你最关注的角度、课堂讨论问题或阅读延伸。"
                value={spacetimeForm.promptNotes}
                onChange={(e) => setSpacetimeForm((prev) => ({ ...prev, promptNotes: e.target.value }))}
                rows={4}
              />
              <GradientButton variant="primary" onClick={handleGenerateSpacetime} disabled={spacetimeLoading}>
                {spacetimeLoading ? '生成中...' : '生成分析提纲'}
              </GradientButton>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">历史记录</h3>
                {spacetimeAnalyses.length === 0 ? (
                  <p className="text-sm text-gray-500">还没有生成记录，试着先构建一个文学时空。</p>
                ) : (
                  <ul className="space-y-3">
                    {spacetimeAnalyses.map((analysis) => (
                      <li
                        key={analysis.analysisId}
                        className="space-y-3 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-purple-600">
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
                          {analysis.promptNotes ? (
                            <p className="text-xs text-gray-500">学生补充：{analysis.promptNotes}</p>
                          ) : null}
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-line">
                          {analysis.generatedContent}
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
                <h2 className="text-xl font-semibold text-gray-900">课堂画廊 - 本节课学生作品展示</h2>
                <p className="text-sm text-gray-500">欣赏同学们的创作灵感，点击查看详情。</p>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {gallery.map((item) => (
                  <button
                    type="button"
                    key={item.imageId}
                    onClick={() => handleGalleryItemClick(item)}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <img src={item.imageUrl} alt={item.sceneDescription} className="h-32 w-full object-cover" />
                    <div className="space-y-1 px-4 py-3 text-sm">
                      <p className="font-semibold text-gray-800">作者：{item.username}</p>
                      <p className="text-gray-600">风格：{item.style}</p>
                      <p className="truncate text-gray-500">{item.sceneDescription}</p>
                    </div>
                  </button>
                ))}
                {gallery.length === 0 ? <p className="text-sm text-gray-500">尚无作品分享，快来成为第一个!</p> : null}
              </div>
            </Card>
          ) : null}
        </section>
      </main>
      {editModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={closeEditModal}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">继续编辑图像</h3>
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" onClick={closeGalleryPreview}>
          <div
            className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl"
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
