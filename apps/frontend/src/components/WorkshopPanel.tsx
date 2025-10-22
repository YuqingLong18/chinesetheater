import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';
import type {
  WorkshopRoomSummary,
  WorkshopMember,
  WorkshopContribution,
  WorkshopChatMessage,
  WorkshopVoteType,
  WorkshopBoard,
  WorkshopBoardVersion,
  WorkshopAiSuggestion,
  WorkshopReactionType
} from '../types';
import GradientButton from './GradientButton';
import TextInput from './TextInput';
import TextArea from './TextArea';

interface CreateRoomForm {
  title: string;
  mode: 'relay' | 'adaptation';
  theme: string;
  meterRequirement: string;
  maxParticipants: number;
  targetLines: number;
  timeLimitMinutes?: number | null;
}

const defaultForm: CreateRoomForm = {
  title: '',
  mode: 'relay',
  theme: '',
  meterRequirement: '',
  maxParticipants: 6,
  targetLines: 8
};

const WorkshopPanel = () => {
  const { studentProfile, teacherProfile, studentToken, teacherToken } = useAuthStore();
  const [rooms, setRooms] = useState<WorkshopRoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<WorkshopRoomSummary | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingRoomDetail, setLoadingRoomDetail] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRoomForm>(defaultForm);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [newLine, setNewLine] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [boardDraft, setBoardDraft] = useState('');
  const [boardSaving, setBoardSaving] = useState(false);
  const [versions, setVersions] = useState<WorkshopBoardVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WorkshopAiSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const activeBoardIdRef = useRef<number | null>(null);

  const currentUserRole: 'student' | 'teacher' = studentProfile ? 'student' : 'teacher';
  const currentUserId = studentProfile?.id ?? teacherProfile?.id ?? 0;

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError(null);
    try {
      const response = await client.get('/student/workshops');
      const data = response.data.rooms as WorkshopRoomSummary[];
      setRooms(data);
      if (selectedRoomId) {
        const stillExists = data.find((room) => room.roomId === selectedRoomId);
        if (!stillExists) {
          setSelectedRoomId(data[0]?.roomId ?? null);
        }
      } else if (data.length > 0) {
        setSelectedRoomId(data[0].roomId);
      }
    } catch (err) {
      console.error(err);
      setError('加载创作房间失败');
    } finally {
      setLoadingRooms(false);
    }
  }, [selectedRoomId]);

  const fetchRoomDetail = useCallback(
    async (roomId: number) => {
      setLoadingRoomDetail(true);
      setError(null);
      try {
        const response = await client.get(`/student/workshops/${roomId}`);
        const room = response.data.room as WorkshopRoomSummary;
        setSelectedRoom(room);
      } catch (err) {
        console.error(err);
        setError('加载房间详情失败');
      } finally {
        setLoadingRoomDetail(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (selectedRoomId) {
      fetchRoomDetail(selectedRoomId);
    } else {
      setSelectedRoom(null);
    }
  }, [selectedRoomId, fetchRoomDetail]);

  useEffect(() => {
    activeBoardIdRef.current = activeBoardId;
  }, [activeBoardId]);

  useEffect(() => {
    if (!selectedRoom) {
      return undefined;
    }

    const token = studentToken ?? teacherToken;
    const url = token
      ? `/api/student/workshops/${selectedRoom.roomId}/stream?token=${encodeURIComponent(token)}`
      : `/api/student/workshops/${selectedRoom.roomId}/stream`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('member.join', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as WorkshopMember;
      setSelectedRoom((prev) => (prev ? { ...prev, members: [...prev.members, payload] } : prev));
      setRooms((prev) =>
        prev.map((room) =>
          room.roomId === payload.roomId ? { ...room, members: [...room.members, payload] } : room
        )
      );
    });

    eventSource.addEventListener('contribution.added', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { contribution: WorkshopContribution; nextTurnOrder: number };
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const contributions = [...(prev.contributions ?? []), payload.contribution].sort((a, b) => a.orderIndex - b.orderIndex);
        return { ...prev, contributions, currentTurnOrder: payload.nextTurnOrder };
      });
      setRooms((prev) =>
        prev.map((room) =>
          room.roomId === payload.contribution.roomId
            ? { ...room, currentTurnOrder: payload.nextTurnOrder }
            : room
        )
      );
    });

    eventSource.addEventListener('contribution.feedback', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as WorkshopContribution;
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const contributions = (prev.contributions ?? []).map((item) =>
          item.contributionId === payload.contributionId ? { ...item, aiFeedback: payload.aiFeedback } : item
        );
        return { ...prev, contributions };
      });
    });

    eventSource.addEventListener('contribution.status', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { contributionId: number; status: WorkshopContribution['status'] };
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const contributions = (prev.contributions ?? []).map((item) =>
          item.contributionId === payload.contributionId ? { ...item, status: payload.status } : item
        );
        return { ...prev, contributions };
      });
    });

    eventSource.addEventListener('vote.update', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { contributionId: number; memberId: number; voteType: WorkshopVoteType };
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const contributions = (prev.contributions ?? []).map((item) => {
          if (item.contributionId !== payload.contributionId) return item;
          const existing = item.votes.find((vote) => vote.memberId === payload.memberId);
          let votes;
          if (existing) {
            votes = item.votes.map((vote) =>
              vote.memberId === payload.memberId ? { ...vote, voteType: payload.voteType } : vote
            );
          } else {
            votes = [...item.votes, { voteId: Date.now(), contributionId: payload.contributionId, memberId: payload.memberId, voteType: payload.voteType, createdAt: new Date().toISOString() }];
          }
          return { ...item, votes };
        });
        return { ...prev, contributions };
      });
    });

    eventSource.addEventListener('chat.message', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as WorkshopChatMessage;
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const chats = [...(prev.chats ?? []), payload];
        return { ...prev, chats };
      });
    });

    eventSource.addEventListener('board.updated', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as WorkshopBoard;
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const boards = (prev.boards ?? []).map((board) => (board.boardId === payload.boardId ? payload : board));
        return { ...prev, boards };
      });
      setRooms((prev) =>
        prev.map((room) =>
          room.roomId === payload.roomId
            ? {
                ...room,
                boards: (room.boards ?? []).map((board) => (board.boardId === payload.boardId ? payload : board))
              }
            : room
        )
      );
      const currentActiveId = activeBoardIdRef.current;
      if (currentActiveId === null) {
        setActiveBoardId(payload.boardId);
        activeBoardIdRef.current = payload.boardId;
        setBoardDraft(payload.content);
        setVersions(payload.versions ?? []);
      } else if (currentActiveId === payload.boardId) {
        setBoardDraft(payload.content);
        setVersions(payload.versions ?? []);
      }
    });

    eventSource.addEventListener('suggestion.added', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as WorkshopAiSuggestion;
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        const suggestionsList = [...(prev.suggestions ?? []), payload];
        return { ...prev, suggestions: suggestionsList };
      });
      setSuggestions((prev) => [...prev, payload]);
    });

    eventSource.addEventListener('reaction.update', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        targetType: 'contribution' | 'board';
        targetId: number;
        memberId: number;
        reactionType: WorkshopReactionType | null;
      };
      setSelectedRoom((prev) => {
        if (!prev) return prev;
        if (payload.targetType === 'contribution') {
          const contributions = (prev.contributions ?? []).map((item) => {
            if (item.contributionId !== payload.targetId) return item;
            const reactions = item.reactions ?? [];
            const existingIndex = reactions.findIndex((reaction) => reaction.memberId === payload.memberId);
            let next = reactions;
            if (payload.reactionType === null) {
              next = existingIndex >= 0 ? reactions.filter((_, index) => index !== existingIndex) : reactions;
            } else if (existingIndex >= 0) {
              next = reactions.map((reaction, index) =>
                index === existingIndex ? { ...reaction, reactionType: payload.reactionType } : reaction
              );
            } else {
              next = [
                ...reactions,
                {
                  reactionId: Date.now(),
                  roomId: prev.roomId,
                  memberId: payload.memberId,
                  targetType: 'contribution' as const,
                  targetId: payload.targetId,
                  reactionType: payload.reactionType,
                  createdAt: new Date().toISOString()
                }
              ];
            }
            return { ...item, reactions: next };
          });
          return { ...prev, contributions };
        }
        const boards = (prev.boards ?? []).map((board) => {
          if (board.boardId !== payload.targetId) return board;
          const reactions = board.reactions ?? [];
          const existingIndex = reactions.findIndex((reaction) => reaction.memberId === payload.memberId);
          let next = reactions;
          if (payload.reactionType === null) {
            next = existingIndex >= 0 ? reactions.filter((_, index) => index !== existingIndex) : reactions;
          } else if (existingIndex >= 0) {
            next = reactions.map((reaction, index) =>
              index === existingIndex ? { ...reaction, reactionType: payload.reactionType } : reaction
            );
          } else {
            next = [
              ...reactions,
              {
                reactionId: Date.now(),
                roomId: prev.roomId,
                memberId: payload.memberId,
                targetType: 'board' as const,
                targetId: payload.targetId,
                reactionType: payload.reactionType ?? 'like',
                createdAt: new Date().toISOString()
              }
            ];
          }
          return { ...board, reactions: next };
        });
        return { ...prev, boards };
      });
    });

    return () => {
      eventSource.close();
    };
  }, [selectedRoom, studentToken, teacherToken]);

  useEffect(() => {
    if (!selectedRoom) {
      setActiveBoardId(null);
      activeBoardIdRef.current = null;
      setBoardDraft('');
      setVersions([]);
      setSuggestions([]);
      return;
    }

    if (selectedRoom.mode !== 'adaptation') {
      setActiveBoardId(null);
      activeBoardIdRef.current = null;
      setBoardDraft('');
      setVersions([]);
      setSuggestions([]);
      return;
    }

    const boards = selectedRoom.boards ?? [];
    setSuggestions(selectedRoom.suggestions ?? []);

    if (boards.length === 0) {
      setActiveBoardId(null);
      activeBoardIdRef.current = null;
      setBoardDraft('');
      setVersions([]);
      return;
    }

    const currentId = activeBoardIdRef.current;
    const active = currentId ? boards.find((board) => board.boardId === currentId) ?? null : null;
    const nextBoard = active ?? boards[0];

    if (!currentId || !active) {
      setActiveBoardId(nextBoard.boardId);
      activeBoardIdRef.current = nextBoard.boardId;
    }

    setBoardDraft(nextBoard.content);
    setVersions(nextBoard.versions ?? []);
  }, [selectedRoom]);

  const myMember = useMemo(() => {
    if (!selectedRoom) return null;
    return selectedRoom.members.find((member) =>
      currentUserRole === 'student' ? member.studentId === currentUserId : member.teacherId === currentUserId
    ) ?? null;
  }, [selectedRoom, currentUserRole, currentUserId]);

  const isMyTurn = useMemo(() => {
    if (!selectedRoom || !myMember) return false;
    const index = selectedRoom.members.findIndex((member) => member.memberId === myMember.memberId);
    const current = selectedRoom.currentTurnOrder ?? 0;
    return index === current;
  }, [selectedRoom, myMember]);

  const activeBoard = useMemo(() => {
    if (!selectedRoom || selectedRoom.mode !== 'adaptation') {
      return null;
    }
    return (selectedRoom.boards ?? []).find((board) => board.boardId === activeBoardId) ?? null;
  }, [selectedRoom, activeBoardId]);

  const handleCreateRoom = async () => {
    if (!createForm.title.trim()) {
      setError('请输入创作房间名称');
      return;
    }
    setError(null);
    setJoinLoading(true);
    try {
      await client.post('/student/workshops', {
        title: createForm.title,
        mode: createForm.mode,
        theme: createForm.theme || null,
        meterRequirement: createForm.meterRequirement || null,
        maxParticipants: createForm.maxParticipants,
        targetLines: createForm.targetLines,
        timeLimitMinutes: createForm.timeLimitMinutes ?? null
      });
      setCreateForm(defaultForm);
      setShowCreate(false);
      await fetchRooms();
    } catch (err) {
      console.error(err);
      setError('创建房间失败');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setError('请输入房间码');
      return;
    }
    setJoinLoading(true);
    setError(null);
    try {
      await client.post('/student/workshops/join', { code: joinCode.trim(), nickname: (studentProfile ?? teacherProfile)?.username });
      await fetchRooms();
      setJoinCode('');
    } catch (err) {
      console.error(err);
      setError('加入房间失败');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleSubmitLine = async () => {
    if (!selectedRoom || !myMember) return;
    setSubmitLoading(true);
    setError(null);
    try {
      await client.post(`/student/workshops/${selectedRoom.roomId}/contributions`, { content: newLine });
      setNewLine('');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : '提交失败';
      setError(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!selectedRoom || !myMember || !chatMessage.trim()) return;
    setChatLoading(true);
    setError(null);
    try {
      await client.post(`/student/workshops/${selectedRoom.roomId}/chat`, { content: chatMessage });
      setChatMessage('');
    } catch (err) {
      console.error(err);
      setError('发送消息失败');
    } finally {
      setChatLoading(false);
    }
  };

  const handleVote = async (contributionId: number, voteType: WorkshopVoteType) => {
    if (!selectedRoom || !myMember) return;
    try {
      await client.post(`/student/workshops/${selectedRoom.roomId}/votes`, { contributionId, voteType });
    } catch (err) {
      console.error(err);
      setError('投票失败');
    }
  };

  const handleSaveBoard = async () => {
    if (!selectedRoom || selectedRoom.mode !== 'adaptation' || !activeBoard || !myMember) {
      return;
    }
    setBoardSaving(true);
    setError(null);
    try {
      await client.post(`/student/workshops/${selectedRoom.roomId}/boards/${activeBoard.boardId}`, {
        content: boardDraft,
        summary: `由${myMember.nickname}更新`
      });
    } catch (err) {
      console.error(err);
      setError('保存创作板块失败');
    } finally {
      setBoardSaving(false);
    }
  };

  const handleLoadVersions = async () => {
    if (!selectedRoom || selectedRoom.mode !== 'adaptation' || !activeBoard) {
      return;
    }
    setVersionsLoading(true);
    try {
      const response = await client.get(`/student/workshops/${selectedRoom.roomId}/boards/${activeBoard.boardId}/versions`);
      setVersions(response.data.versions ?? []);
    } catch (err) {
      console.error(err);
      setError('加载版本历史失败');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRequestSuggestion = async () => {
    if (!selectedRoom || selectedRoom.mode !== 'adaptation') {
      return;
    }
    setSuggestionLoading(true);
    setError(null);
    try {
      const response = await client.post(`/student/workshops/${selectedRoom.roomId}/suggestions`, {
        boardId: activeBoard?.boardId ?? null
      });
      const newSuggestions = response.data.suggestions as WorkshopAiSuggestion[];
      setSuggestions((prev) => [...prev, ...(newSuggestions ?? [])]);
    } catch (err) {
      console.error(err);
      setError('获取AI建议失败');
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleToggleReaction = async (
    targetType: 'contribution' | 'board',
    targetId: number,
    reactionType: WorkshopReactionType = 'like'
  ) => {
    if (!selectedRoom || !myMember) return;
    try {
      await client.post(`/student/workshops/${selectedRoom.roomId}/reactions`, {
        targetType,
        targetId,
        reactionType
      });
    } catch (err) {
      console.error(err);
      setError('操作失败，请稍后再试');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">创作房间</h3>
          <GradientButton variant="secondary" onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? '取消' : '新建'}
          </GradientButton>
        </div>
        {showCreate ? (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            <TextInput label="房间名称" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              <span>创作模式</span>
              <select
                value={createForm.mode}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, mode: e.target.value as 'relay' | 'adaptation' }))}
                className="rounded-lg border border-gray-200 px-3 py-2"
              >
                <option value="relay">接龙续写</option>
                <option value="adaptation">改编创作（预览版）</option>
              </select>
            </label>
            <TextInput label="创作主题" value={createForm.theme} onChange={(e) => setCreateForm((prev) => ({ ...prev, theme: e.target.value }))} />
            <TextInput label="格律要求" placeholder="如：五言绝句" value={createForm.meterRequirement} onChange={(e) => setCreateForm((prev) => ({ ...prev, meterRequirement: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="人数上限"
                type="number"
                min={2}
                max={10}
                value={createForm.maxParticipants}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, maxParticipants: Number(e.target.value) }))}
              />
              <TextInput
                label="目标句数"
                type="number"
                min={4}
                value={createForm.targetLines}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, targetLines: Number(e.target.value) }))}
              />
            </div>
            <GradientButton variant="primary" onClick={handleCreateRoom} disabled={joinLoading}>
              {joinLoading ? '创建中...' : '创建房间'}
            </GradientButton>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="输入房间码加入"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <GradientButton variant="primary" onClick={handleJoin} disabled={joinLoading}>
              {joinLoading ? '加入中...' : '加入'}
            </GradientButton>
          </div>
        </div>

        {loadingRooms ? <p className="text-sm text-gray-500">房间加载中...</p> : null}
        <div className="space-y-2">
          {rooms.map((room) => (
            <button
              key={room.roomId}
              type="button"
              onClick={() => setSelectedRoomId(room.roomId)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                selectedRoomId === room.roomId ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white hover:border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{room.title}</span>
                <span className="text-xs text-gray-500">{room.mode === 'relay' ? '接龙' : '改编'}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">成员 {room.members.length}/{room.maxParticipants}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

        {selectedRoom ? (
          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedRoom.title}</h2>
                <p className="text-sm text-gray-500">房间码：{selectedRoom.code}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>模式：{selectedRoom.mode === 'relay' ? '接龙续写' : '改编创作'}</p>
                {selectedRoom.meterRequirement ? <p>格律：{selectedRoom.meterRequirement}</p> : null}
              </div>
            </div>

            {selectedRoom.mode === 'relay' ? (
              <div className="grid gap-6 lg:grid-cols-[260px_1fr_260px]">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">创作进度</h3>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                    {(selectedRoom.contributions ?? []).map((item) => {
                      const member = selectedRoom.members.find((m) => m.memberId === item.memberId);
                      const reactions = item.reactions ?? [];
                      const liked = myMember ? reactions.some((reaction) => reaction.memberId === myMember.memberId) : false;
                      return (
                        <div key={item.contributionId} className="rounded-lg border border-white bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{member?.nickname ?? '成员'}</span>
                            <span>{new Date(item.createdAt).toLocaleTimeString('zh-CN')}</span>
                          </div>
                          <p className="mt-2 text-gray-800">{item.content}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="rounded bg-blue-50 px-2 py-0.5">状态：{item.status === 'accepted' ? '已采纳' : item.status === 'pending' ? '待修改' : '已撤回'}</span>
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleVote(item.contributionId, 'rewrite')}
                            >
                              请求重写
                            </button>
                            <button
                              type="button"
                              className={`rounded px-2 py-0.5 transition ${liked ? 'bg-pink-100 text-pink-600' : 'text-pink-500 hover:bg-pink-50'}`}
                              onClick={() => handleToggleReaction('contribution', item.contributionId, 'like')}
                            >
                              👍 {reactions.length}
                            </button>
                          </div>
                          {item.aiFeedback ? (
                            <details className="mt-2 rounded-lg bg-blue-50 p-2 text-xs">
                              <summary className="cursor-pointer text-blue-600">AI 点评</summary>
                              <pre className="whitespace-pre-wrap text-gray-700">{JSON.stringify(item.aiFeedback, null, 2)}</pre>
                            </details>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-700">当前轮到</h3>
                    <p className="mt-2 text-lg font-semibold text-blue-600">
                      {isMyTurn ? '轮到你了，请续写下一句' : selectedRoom.members[selectedRoom.currentTurnOrder ?? 0]?.nickname ?? '等待成员加入'}
                    </p>
                    <TextArea
                      label="下一句诗词"
                      placeholder="请续写下一句，保持意境连贯"
                      value={newLine}
                      onChange={(e) => setNewLine(e.target.value)}
                      rows={4}
                      disabled={!isMyTurn || submitLoading}
                    />
                    <GradientButton className="mt-3" variant="primary" onClick={handleSubmitLine} disabled={!isMyTurn || submitLoading}>
                      {submitLoading ? '提交中...' : '提交诗句'}
                    </GradientButton>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-700">讨论区</h3>
                    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm">
                      {(selectedRoom.chats ?? []).map((chat) => (
                        <div key={chat.messageId} className="rounded-lg bg-white p-2 shadow-sm">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{chat.member?.nickname ?? '系统'}</span>
                            <span>{new Date(chat.createdAt).toLocaleTimeString('zh-CN')}</span>
                          </div>
                          <p className="mt-1 text-gray-700">{chat.content}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="发送讨论信息"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <GradientButton variant="secondary" onClick={handleSendChat} disabled={chatLoading}>
                        发送
                      </GradientButton>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-700">成员一览</h3>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      {selectedRoom.members.map((member) => (
                        <li key={member.memberId} className="flex items-center justify-between">
                          <span>{member.nickname}</span>
                          <span className="text-xs text-gray-400">{member.isActive ? '在线' : '离线'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-blue-50/60 p-4 text-sm text-gray-700">
                    <h3 className="text-sm font-semibold text-blue-700">创作提示</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li key="tip-theme">尝试引用意象：{selectedRoom.theme || selectedRoom.originalTitle || '结合课堂主题'}</li>
                      {selectedRoom.meterRequirement ? (
                        <li key="tip-meter">确保平仄与押韵符合 {selectedRoom.meterRequirement}</li>
                      ) : null}
                      {selectedRoom.targetLines ? (
                        <li key="tip-target">目标句数 {selectedRoom.targetLines}，请把握篇幅</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedRoom.originalContent ? (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-sm text-gray-700">
                    <h3 className="text-sm font-semibold text-purple-700">原作参考：{selectedRoom.originalTitle ?? '课堂作品'}</h3>
                    <p className="mt-2 whitespace-pre-line leading-relaxed">{selectedRoom.originalContent}</p>
                  </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
                  <aside className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">创作板块</h3>
                    <div className="space-y-2">
                      {(selectedRoom.boards ?? []).map((board) => {
                        const reactions = board.reactions ?? [];
                        const liked = myMember ? reactions.some((reaction) => reaction.memberId === myMember.memberId) : false;
                        return (
                          <button
                            key={board.boardId}
                            type="button"
                            onClick={() => setActiveBoardId(board.boardId)}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                              board.boardId === activeBoardId ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white hover:border-purple-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{board.title}</span>
                              <span className="text-xs text-gray-400">👍 {reactions.length}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{board.content || '待编辑'}</p>
                            {liked ? <span className="text-xs text-pink-500">已点赞</span> : null}
                          </button>
                        );
                      })}
                    </div>
                    {activeBoard ? (
                      <button
                        type="button"
                        onClick={() => handleToggleReaction('board', activeBoard.boardId, 'like')}
                        className={`w-full rounded-lg px-3 py-2 text-sm transition ${
                          activeBoard.reactions?.some((reaction) => reaction.memberId === myMember?.memberId)
                            ? 'bg-pink-100 text-pink-600'
                            : 'border border-pink-200 text-pink-500 hover:bg-pink-50'
                        }`}
                      >
                        喜欢这个板块
                      </button>
                    ) : null}
                  </aside>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-semibold text-gray-700">共创内容</h3>
                      <TextArea
                        label={activeBoard?.title ?? '请选择板块'}
                        value={boardDraft}
                        onChange={(e) => setBoardDraft(e.target.value)}
                        rows={10}
                        disabled={!activeBoard || boardSaving}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <GradientButton variant="primary" onClick={handleSaveBoard} disabled={!activeBoard || boardSaving}>
                          {boardSaving ? '保存中...' : '保存修改'}
                        </GradientButton>
                        <GradientButton variant="secondary" onClick={handleLoadVersions} disabled={!activeBoard || versionsLoading}>
                          {versionsLoading ? '加载中...' : '查看历史'}
                        </GradientButton>
                        <GradientButton variant="secondary" onClick={handleRequestSuggestion} disabled={suggestionLoading}>
                          {suggestionLoading ? '请稍候...' : '获取AI建议'}
                        </GradientButton>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-gray-700">历史版本</h3>
                      {versions.length === 0 ? (
                        <p className="text-xs text-gray-500">暂无历史记录</p>
                      ) : (
                        <ul className="mt-2 space-y-2 text-xs text-gray-600">
                          {versions.map((version) => (
                            <li key={version.versionId} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                              <div className="flex items-center justify-between">
                                <span>{version.member?.nickname ?? '成员'} · {new Date(version.createdAt).toLocaleTimeString('zh-CN')}</span>
                                {version.summary ? <span className="text-gray-400">{version.summary}</span> : null}
                              </div>
                              <p className="mt-1 whitespace-pre-line text-gray-700">{version.content}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-semibold text-gray-700">讨论区</h3>
                      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm">
                        {(selectedRoom.chats ?? []).map((chat) => (
                          <div key={chat.messageId} className="rounded-lg bg-white p-2 shadow-sm">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{chat.member?.nickname ?? '系统'}</span>
                              <span>{new Date(chat.createdAt).toLocaleTimeString('zh-CN')}</span>
                            </div>
                            <p className="mt-1 text-gray-700">{chat.content}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="发送讨论信息"
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <GradientButton variant="secondary" onClick={handleSendChat} disabled={chatLoading}>
                          发送
                        </GradientButton>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-semibold text-gray-700">AI 创作建议</h3>
                      {suggestions.length === 0 ? (
                        <p className="text-xs text-gray-500">点击获取AI建议，帮助团队统一方向。</p>
                      ) : (
                        <ul className="mt-2 space-y-2 text-xs text-gray-600">
                          {suggestions.map((suggestion) => (
                            <li key={suggestion.suggestionId} className="rounded-lg border border-blue-200 bg-blue-50/70 p-2">
                              <span className="font-semibold text-blue-600">[{suggestion.suggestionType}]</span>
                              <p className="mt-1 whitespace-pre-line text-gray-700">{suggestion.content}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-semibold text-gray-700">成员一览</h3>
                      <ul className="mt-2 space-y-1 text-sm text-gray-600">
                        {selectedRoom.members.map((member) => (
                          <li key={member.memberId} className="flex items-center justify-between">
                            <span>{member.nickname}</span>
                            <span className="text-xs text-gray-400">{member.isActive ? '在线' : '离线'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : loadingRoomDetail ? (
          <p className="text-sm text-gray-500">房间加载中...</p>
        ) : (
          <p className="text-sm text-gray-500">请选择或创建一个创作房间开始协作。</p>
        )}
      </section>
    </div>
  );
};

export default WorkshopPanel;
