import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import GradientButton from '../../components/GradientButton';
import FeatureButton from '../../components/FeatureButton';
import TextArea from '../../components/TextArea';
import TextInput from '../../components/TextInput';
import ChatBubble from '../../components/ChatBubble';
import client from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { StudentGalleryItem } from '../../types';

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

type FeatureKey = 'chat' | 'writing' | 'gallery';

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

  const editRemaining = useMemo(() => (generatedImage ? Math.max(0, 2 - generatedImage.editCount) : 2), [generatedImage]);

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

    fetchSession();
    fetchChatHistory();
    fetchGallery();
  }, []);

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
      setMessage('发送失败，请稍后重试');
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
      setMessage('生成失败，请稍后再试');
    } finally {
      setLoadingImage(false);
    }
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
      setMessage('分享失败，请稍后再试');
    }
  };

  const handleLogout = () => {
    logoutStudent();
    navigate('/student-login');
  };

  const featureButtons = [
    { key: 'chat' as FeatureKey, label: '与作者对话', variant: 'primary' as const },
    { key: 'writing' as FeatureKey, label: '描述性写作', variant: 'secondary' as const },
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
                    <p>场景：{generatedImage.sceneDescription}</p>
                    <p>剩余编辑次数：{editRemaining}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <GradientButton
                      variant="primary"
                      disabled={loadingImage || generatedImage.editCount >= 2}
                      onClick={() => {
                        setImageForm({ style: generatedImage.style, sceneDescription: generatedImage.sceneDescription });
                      }}
                    >
                      重新编辑描述
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

          {activeFeature === 'gallery' ? (
            <Card className="space-y-4">
              <header>
                <h2 className="text-xl font-semibold text-gray-900">课堂画廊 - 本节课学生作品展示</h2>
                <p className="text-sm text-gray-500">欣赏同学们的创作灵感，点击查看详情。</p>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {gallery.map((item) => (
                  <div key={item.imageId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <img src={item.imageUrl} alt={item.sceneDescription} className="h-32 w-full object-cover" />
                    <div className="space-y-1 px-4 py-3 text-sm">
                      <p className="font-semibold text-gray-800">作者：{item.username}</p>
                      <p className="text-gray-600">风格：{item.style}</p>
                      <p className="truncate text-gray-500">{item.sceneDescription}</p>
                    </div>
                  </div>
                ))}
                {gallery.length === 0 ? <p className="text-sm text-gray-500">尚无作品分享，快来成为第一个!</p> : null}
              </div>
            </Card>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default StudentWorkspacePage;
