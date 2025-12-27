import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkshopRoomSummary, WorkshopMember, WorkshopContribution } from '../../types';
import GradientButton from '../GradientButton';
import TextArea from '../TextArea';

interface WorkshopRelayViewProps {
    room: WorkshopRoomSummary;
    myMember: WorkshopMember | null;
    actions: {
        submitContribution: (roomId: number, content: string) => Promise<any>;
        sendChat: (roomId: number, content: string) => Promise<any>;
        vote: (roomId: number, contributionId: number, type: any) => Promise<any>;
    }
}

export const WorkshopRelayView = ({ room, myMember, actions }: WorkshopRelayViewProps) => {
    const [newLine, setNewLine] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new contribution
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [room.contributions?.length]);

    const currentTurnMember = useMemo(() => {
        if (!room.members.length) return null;
        if (typeof room.currentTurnOrder === 'number') {
            return room.members[room.currentTurnOrder] ?? null;
        }
        return room.members[0];
    }, [room]);

    const isMyTurn = currentTurnMember?.memberId === myMember?.memberId;

    const handleSubmit = async () => {
        if (!newLine.trim()) return;
        setSubmitting(true);
        try {
            await actions.submitContribution(room.roomId, newLine);
            setNewLine('');
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-gray-50 relative overflow-hidden">
            {/* Background: Flowing Stream Effect */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                <div className="absolute left-1/2 top-0 bottom-0 w-32 -ml-16 bg-blue-400 blur-3xl transform skew-x-12"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-gray-200 shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 font-serif">{room.title}</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">曲水流觞</span>
                        <span>{room.members.length} 位贤集聚</span>
                    </div>
                </div>
                {/* Current Turn Indicator (Cup) */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">当前执杯:</span>
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">
                            {currentTurnMember?.nickname?.[0]}
                        </div>
                        <span className="font-semibold text-indigo-900 text-sm">{currentTurnMember?.nickname}</span>
                    </div>
                </div>
            </div>

            {/* Stream Content Area */}
            <div className="flex-1 overflow-y-auto relative z-10 p-8" ref={scrollRef}>
                <div className="max-w-3xl mx-auto relative min-h-full">
                    {/* Central Line (Stream) */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-200 transform -translate-x-1/2 rounded-full hidden md:block"></div>

                    {/* Contributions */}
                    <div className="space-y-12 pb-20">
                        {room.contributions?.map((c, i) => {
                            const isLeft = i % 2 === 0;
                            return (
                                <div key={c.contributionId} className={`flex items-start gap-4 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                    {/* Avatar */}
                                    <div className="flex flex-col items-center gap-1 flex-shrink-0 z-10">
                                        <div className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center text-gray-700 font-bold text-sm ring-2 ring-blue-100">
                                            {c.member?.nickname?.[0]}
                                        </div>
                                        <span className="text-xs text-gray-400 max-w-[4rem] truncate text-center">{c.member?.nickname}</span>
                                    </div>

                                    {/* Bubble */}
                                    <div className={`flex-1 relative group ${isLeft ? 'text-left' : 'text-right md:text-left'}`}>
                                        <div className={`absolute top-4 ${isLeft ? '-left-2 md:-left-2' : '-left-2 md:left-auto md:-right-2'} w-4 h-4 bg-white transform rotate-45 border-b border-l border-gray-100 z-0`}></div>
                                        <div className="relative bg-white p-5 rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow duration-200 z-10">
                                            <p className="text-lg font-serif text-gray-800 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                                                <span>第 {i + 1} 句</span>
                                                <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Empty spacer for alignment */}
                                    <div className="flex-1 hidden md:block"></div>
                                </div>
                            );
                        })}

                        {/* Placeholder for Next Turn */}
                        <div className={`flex items-start gap-4 opacity-100 transition-opacity duration-500 ${(room.contributions?.length ?? 0) % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0 z-10">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${isMyTurn
                                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-200 scale-110'
                                        : 'bg-gray-200 text-gray-400'
                                    }`}>
                                    {currentTurnMember?.nickname?.[0] ?? '?'}
                                </div>
                            </div>
                            <div className="flex-1">
                                {isMyTurn && (
                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl animate-pulse">
                                        <p className="text-indigo-800 text-sm font-medium text-center">轮到你了！请把酒挥毫...</p>
                                    </div>
                                )}
                                {!isMyTurn && (
                                    <div className="py-2 px-4">
                                        <p className="text-gray-400 text-sm italic">等待 {currentTurnMember?.nickname} 斟酌中...</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 hidden md:block"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Input Footer */}
            <div className="bg-white p-4 border-t border-gray-200 z-20 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
                <div className="max-w-3xl mx-auto flex gap-4">
                    <div className="flex-1 relative">
                        <TextArea
                            label=""
                            disabled={!isMyTurn || submitting}
                            value={newLine}
                            onChange={(e) => setNewLine(e.target.value)}
                            placeholder={isMyTurn ? "接续前文，请赋诗一句..." : "静待流觞..."}
                            className="bg-gray-50 focus:bg-white transition-colors border-0 ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-300 rounded-xl"
                            rows={2}
                        // Using standard onKeyDown for quick submit? Maybe later.
                        />
                        {!isMyTurn && <div className="absolute inset-0 bg-gray-50/50 cursor-not-allowed rounded-xl" />}
                    </div>
                    <GradientButton
                        disabled={!isMyTurn || submitting || !newLine.trim()}
                        onClick={handleSubmit}
                        className="h-auto rounded-xl shadow-lg shadow-indigo-200 disabled:shadow-none"
                    >
                        {submitting ? '提交...' : '提交'}
                    </GradientButton>
                </div>
            </div>
        </div>
    );
};
