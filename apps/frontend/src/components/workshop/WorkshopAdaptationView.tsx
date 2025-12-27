import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkshopAiSuggestion, WorkshopBoard, WorkshopBoardVersion, WorkshopMember, WorkshopRoomSummary } from '../../types';
import GradientButton from '../GradientButton';
import TextArea from '../TextArea';

interface WorkshopAdaptationViewProps {
    room: WorkshopRoomSummary;
    myMember: WorkshopMember | null;
    actions: {
        updateBoard: (roomId: number, boardId: number, content: string, summary?: string) => Promise<any>;
        getBoardVersions: (roomId: number, boardId: number) => Promise<{ data: { versions: WorkshopBoardVersion[] } }>;
        requestSuggestion: (roomId: number, boardId: number | null) => Promise<any>;
        toggleReaction: (roomId: number, targetType: 'board', targetId: number, reactionType: any) => Promise<any>;
    }
}

export const WorkshopAdaptationView = ({ room, myMember, actions }: WorkshopAdaptationViewProps) => {
    const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
    const [boardDraft, setBoardDraft] = useState('');
    const [boardSaving, setBoardSaving] = useState(false);
    const [versions, setVersions] = useState<WorkshopBoardVersion[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [suggestions, setSuggestions] = useState<WorkshopAiSuggestion[]>([]);
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const activeBoardIdRef = useRef<number | null>(null);

    // Sync internal state with props logic
    useEffect(() => {
        const boards = room.boards ?? [];
        setSuggestions(room.suggestions ?? []);

        if (boards.length === 0) {
            setActiveBoardId(null);
            setBoardDraft('');
            return;
        }

        // If no active board or active board not in list, pick first
        // Note: ref logic from original component might be needed to prevent resets on every update
        // But here we can simply check if activeBoardId is valid
        let nextBoard = boards.find(b => b.boardId === activeBoardId);
        if (!nextBoard) {
            nextBoard = boards[0];
            setActiveBoardId(nextBoard.boardId);
        }

        // Only update draft if it's external update? 
        // The original logic updated draft on EVERY SSE event if it matched active board. 
        // This is harsh for typing. Re-checking original logic.
        // Original: 
        // eventSource.addEventListener('board.updated', ... 
        // if (currentActiveId === payload.boardId) { setBoardDraft(payload.content); ... }
        // This means if someone else saves, it overwrites my drift. That's acceptable for "ver 1.0" concurrent editing.

        // However, since we are in a sub-component, we receive `room` as a prop.
        // If `room` changes, validation runs. 
        // We should check if the CONTENT actually changed to avoid cursor jumps if we were just typing?
        // But `room.boards` content is only updated via SSE `board.updated`. 
        // And that only happens on explicit SAVE. 
        // So it's safe to update draft on room change IF the content differs from what we have 
        // AND we are not "dirty"? 
        // For now, let's stick to the original behavior: "Latest save wins/overwrites".

        if (nextBoard && nextBoard.content !== boardDraft && !boardSaving) {
            setBoardDraft(nextBoard.content);
            setVersions(nextBoard.versions ?? []);
        }
    }, [room, activeBoardId]); // Reduced deps

    const activeBoard = useMemo(() => (room.boards ?? []).find(b => b.boardId === activeBoardId), [room, activeBoardId]);

    const handleSave = async () => {
        if (!activeBoard || !myMember) return;
        setBoardSaving(true);
        setError(null);
        try {
            await actions.updateBoard(room.roomId, activeBoard.boardId, boardDraft, `由${myMember.nickname}更新`);
        } catch (err) {
            setError('保存失败');
        } finally {
            setBoardSaving(false);
        }
    };

    const handleLoadVersions = async () => {
        if (!activeBoard) return;
        setLoadingVersions(true);
        try {
            const res = await actions.getBoardVersions(room.roomId, activeBoard.boardId);
            setVersions(res.data.versions ?? []);
        } catch (err) {
            setError('版本加载失败');
        } finally {
            setLoadingVersions(false);
        }
    };

    const handleAskAI = async () => {
        setLoadingSuggestion(true);
        try {
            await actions.requestSuggestion(room.roomId, activeBoard?.boardId ?? null);
        } catch (err) {
            setError('请求AI失败');
        } finally {
            setLoadingSuggestion(false);
        }
    };


    return (
        <div className="flex h-full flex-col overflow-hidden bg-gray-50">
            {/* Header / Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 scrollbar-hide">
                {(room.boards ?? []).map((board) => (
                    <button
                        key={board.boardId}
                        onClick={() => setActiveBoardId(board.boardId)}
                        className={`mr-4 whitespace-nowrap border-b-2 px-2 py-1 text-sm font-medium transition ${activeBoardId === board.boardId
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {board.title}
                    </button>
                ))}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Main Editor Area */}
                <div className="flex flex-1 flex-col p-4 overflow-y-auto">
                    {error ? <div className="mb-2 text-red-500 text-sm">{error}</div> : null}
                    {activeBoard && (
                        <div className="flex flex-col h-full gap-4">
                            <div className="flex-1 rounded-xl bg-white p-4 shadow-sm">
                                <TextArea
                                    value={boardDraft}
                                    onChange={(e) => setBoardDraft(e.target.value)}
                                    className="h-full w-full resize-none border-none focus:ring-0"
                                    placeholder="在此输入内容..."
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-xs text-gray-500">
                                    {boardSaving ? '保存中...' : '未保存'}
                                </div>
                                <div className="flex gap-2">
                                    <GradientButton variant="secondary" onClick={handleAskAI} disabled={loadingSuggestion}>
                                        {loadingSuggestion ? 'Thinking...' : 'AI灵感'}
                                    </GradientButton>
                                    <GradientButton variant="secondary" onClick={handleLoadVersions}>
                                        历史版本
                                    </GradientButton>
                                    <GradientButton variant="primary" onClick={handleSave} disabled={boardSaving}>
                                        保存更改
                                    </GradientButton>
                                </div>
                            </div>
                        </div>
                    )}
                    {!activeBoard && <div className="m-auto text-gray-400">请选择一个板块</div>}
                </div>

                {/* Right Sidebar: Suggestions / History */}
                {(versions.length > 0 || suggestions.length > 0) && (
                    <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto hidden xl:block">
                        <h4 className="font-semibold text-gray-800 mb-4">辅助信息</h4>

                        {/* Suggestions */}
                        {suggestions.length > 0 && (
                            <div className="mb-6">
                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">AI 建议</h5>
                                <div className="space-y-3">
                                    {suggestions.map((s, i) => (
                                        <div key={i} className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
                                            <div className="mb-1 font-semibold flex justify-between">
                                                <span>AI</span>
                                                <span className="text-xs opacity-70">{new Date(s.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            {s.content}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Versions */}
                        {versions.length > 0 && (
                            <div>
                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">历史版本</h5>
                                <div className="space-y-3">
                                    {versions.map((v) => (
                                        <div key={v.versionId} className="rounded-lg border border-gray-100 p-3 text-sm">
                                            <div className="mb-1 flex justify-between text-xs text-gray-500">
                                                <span>{v.member?.nickname ?? 'Unknown'}</span>
                                                <span>{new Date(v.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="line-clamp-3 text-gray-600">{v.content}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
