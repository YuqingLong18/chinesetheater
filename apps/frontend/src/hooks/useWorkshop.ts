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
    WorkshopReactionType,
    StudentTask
} from '../types';

export interface UseWorkshopOptions {
    onEventError?: (error: Event) => void;
}

export const useWorkshop = (options: UseWorkshopOptions = {}) => {
    const { studentToken, teacherToken, studentProfile, teacherProfile } = useAuthStore();
    const [rooms, setRooms] = useState<WorkshopRoomSummary[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<WorkshopRoomSummary | null>(null);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [loadingRoomDetail, setLoadingRoomDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

    // Derived state
    const currentUserRole: 'student' | 'teacher' = studentProfile ? 'student' : 'teacher';
    const currentUserId = studentProfile?.id ?? teacherProfile?.id ?? 0;

    const myMember = useMemo(() => {
        if (!selectedRoom) return null;
        return selectedRoom.members.find((member) =>
            currentUserRole === 'student' ? member.studentId === currentUserId : member.teacherId === currentUserId
        ) ?? null;
    }, [selectedRoom, currentUserRole, currentUserId]);

    const fetchRooms = useCallback(async () => {
        setLoadingRooms(true);
        setError(null);
        try {
            // Endpoint might differ for teacher vs student, but original code used /student/workshops for both?
            // Re-checking original code: it used /student/workshops. Assuming shared endpoint or role-based access.
            // Wait, original code:
            // const response = await client.get('/student/workshops');
            // Let's keep it consistent.
            const response = await client.get('/student/workshops');
            const data = response.data.rooms as WorkshopRoomSummary[];
            setRooms(data);

            // Auto-select logic
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

    const fetchRoomDetail = useCallback(async (roomId: number) => {
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
    }, []);

    // Initial load
    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    // Detail load
    useEffect(() => {
        if (selectedRoomId) {
            fetchRoomDetail(selectedRoomId);
        } else {
            setSelectedRoom(null);
        }
    }, [selectedRoomId, fetchRoomDetail]);

    // SSE Connection
    useEffect(() => {
        if (!selectedRoomId || !selectedRoom) {
            setConnectionState('disconnected');
            return undefined;
        }

        const token = studentToken ?? teacherToken;
        const url = token
            ? `/api/student/workshops/${selectedRoom.roomId}/stream?token=${encodeURIComponent(token)}`
            : `/api/student/workshops/${selectedRoom.roomId}/stream`;

        setConnectionState('connecting');
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            setConnectionState('connected');
            // Re-fetch detail on connect/reconnect to ensure sync
            fetchRoomDetail(selectedRoom.roomId);
        };

        eventSource.onerror = (e) => {
            // EventSource automatically retries, but we might want to know
            setConnectionState('connecting'); // Assumption: it's trying to reconnect
            if (options.onEventError) options.onEventError(e);
        };

        eventSource.addEventListener('member.join', (event) => {
            const payload = JSON.parse((event as MessageEvent).data) as WorkshopMember;
            setSelectedRoom((prev) => {
                if (!prev) return prev;
                const updatedMembers = [...prev.members, payload].sort((a, b) => a.orderIndex - b.orderIndex);
                return { ...prev, members: updatedMembers };
            });
            // Also update list if needed
            setRooms((prev) =>
                prev.map((room) => {
                    if (room.roomId !== payload.roomId) return room;
                    const updatedMembers = [...room.members, payload].sort((a, b) => a.orderIndex - b.orderIndex);
                    return { ...room, members: updatedMembers };
                })
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
        });

        eventSource.addEventListener('suggestion.added', (event) => {
            const payload = JSON.parse((event as MessageEvent).data) as WorkshopAiSuggestion;
            setSelectedRoom((prev) => {
                if (!prev) return prev;
                const suggestionsList = [...(prev.suggestions ?? []), payload];
                return { ...prev, suggestions: suggestionsList };
            });
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
                // Generic reaction handler logic
                // This is getting complex, maybe should be abstracted further, but for now strict copy is safest
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
                                index === existingIndex ? { ...reaction, reactionType: payload.reactionType! } : reaction
                            );
                        } else if (payload.reactionType) {
                            next = [
                                ...reactions,
                                {
                                    reactionId: Date.now(),
                                    roomId: prev.roomId,
                                    memberId: payload.memberId,
                                    targetType: 'contribution' as const,
                                    targetId: payload.targetId,
                                    reactionType: payload.reactionType!,
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
                            index === existingIndex ? { ...reaction, reactionType: payload.reactionType! } : reaction
                        );
                    } else if (payload.reactionType) {
                        next = [
                            ...reactions,
                            {
                                reactionId: Date.now(),
                                roomId: prev.roomId,
                                memberId: payload.memberId,
                                targetType: 'board' as const,
                                targetId: payload.targetId,
                                reactionType: payload.reactionType!,
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
            setConnectionState('disconnected');
        };
    }, [selectedRoomId, studentToken, teacherToken, fetchRoomDetail]); // added fetchRoomDetail to deps as it's used in onopen

    // Actions
    const createRoom = async (data: any) => {
        await client.post('/student/workshops', data);
        return fetchRooms();
    };

    const joinRoom = async (code: string, nickname: string) => {
        await client.post('/student/workshops/join', { code: code.trim().toUpperCase(), nickname });
        return fetchRooms();
    };

    const refreshRooms = fetchRooms;

    return {
        rooms,
        selectedRoom,
        selectedRoomId,
        setSelectedRoomId,
        loadingRooms,
        loadingRoomDetail,
        connectionState,
        error,
        myMember,
        createRoom,
        joinRoom,
        refreshRooms,
        actions: {
            // We can expose client wrappers here
            submitContribution: (roomId: number, content: string) => client.post(`/student/workshops/${roomId}/contributions`, { content }),
            sendChat: (roomId: number, content: string) => client.post(`/student/workshops/${roomId}/chat`, { content }),
            castVote: (roomId: number, contributionId: number, voteType: WorkshopVoteType) => client.post(`/student/workshops/${roomId}/votes`, { contributionId, voteType }),
            updateBoard: (roomId: number, boardId: number, content: string, summary?: string) => client.post(`/student/workshops/${roomId}/boards/${boardId}`, { content, summary }),
            getBoardVersions: (roomId: number, boardId: number) => client.get(`/student/workshops/${roomId}/boards/${boardId}/versions`),
            requestSuggestion: (roomId: number, boardId: number | null) => client.post(`/student/workshops/${roomId}/suggestions`, { boardId }),
            toggleReaction: (roomId: number, targetType: 'contribution' | 'board', targetId: number, reactionType: WorkshopReactionType) => client.post(`/student/workshops/${roomId}/reactions`, { targetType, targetId, reactionType })
        }
    };
};
