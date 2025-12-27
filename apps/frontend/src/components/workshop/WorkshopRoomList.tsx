import { useState } from 'react';
import type { WorkshopRoomSummary } from '../../types';
import GradientButton from '../GradientButton';
import TextInput from '../TextInput';

interface WorkshopRoomListProps {
    rooms: WorkshopRoomSummary[];
    selectedRoomId: number | null;
    onSelectRoom: (roomId: number) => void;
    onCreateRoom: (data: any) => Promise<void>;
    onJoinRoom: (code: string) => Promise<void>;
    onClose: () => void;
    loading: boolean;
}

const defaultForm = {
    title: '',
    mode: 'relay',
    theme: '',
    meterRequirement: '',
    maxParticipants: 6,
    targetLines: 8,
    timeLimitMinutes: null as number | null
};

export const WorkshopRoomList = ({
    rooms,
    selectedRoomId,
    onSelectRoom,
    onCreateRoom,
    onJoinRoom,
    onClose,
    loading
}: WorkshopRoomListProps) => {
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState(defaultForm);
    const [joinCode, setJoinCode] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!createForm.title.trim()) {
            setError('请输入创作房间名称');
            return;
        }
        setError(null);
        setActionLoading(true);
        try {
            await onCreateRoom(createForm);
            setCreateForm(defaultForm);
            setShowCreate(false);
        } catch (err) {
            // Error handling depends on if onCreateRoom throws. 
            // In this architecture, it probably should throw if failed.
            setError('创建失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!joinCode.trim()) {
            setError('请输入房间码');
            return;
        }
        setError(null);
        setActionLoading(true);
        try {
            await onJoinRoom(joinCode);
            setJoinCode('');
        } catch (err) {
            setError('加入失败');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <aside className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 h-full flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">创作房间</h3>
                <div className="flex items-center gap-2">
                    <GradientButton variant="secondary" onClick={onClose} size="sm">
                        收起
                    </GradientButton>
                    <GradientButton variant="secondary" onClick={() => setShowCreate((prev) => !prev)} size="sm">
                        {showCreate ? '取消' : '新建'}
                    </GradientButton>
                </div>
            </div>

            {error ? <div className="text-xs text-red-500">{error}</div> : null}

            {showCreate ? (
                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm flex-shrink-0 overflow-y-auto max-h-[400px]">
                    <TextInput label="房间名称" value={createForm.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
                    <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                        <span>创作模式</span>
                        <select
                            value={createForm.mode}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateForm((prev) => ({ ...prev, mode: e.target.value as any }))}
                            className="rounded-lg border border-gray-200 px-3 py-2"
                        >
                            <option value="relay">接龙续写</option>
                            <option value="adaptation">改编创作（预览版）</option>
                        </select>
                    </label>
                    <TextInput label="创作主题" value={createForm.theme} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((prev) => ({ ...prev, theme: e.target.value }))} />
                    <TextInput label="格律要求" placeholder="如：五言绝句" value={createForm.meterRequirement} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((prev) => ({ ...prev, meterRequirement: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-3">
                        <TextInput
                            label="人数上限"
                            type="number"
                            min={2}
                            max={10}
                            value={createForm.maxParticipants}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((prev) => ({ ...prev, maxParticipants: Number(e.target.value) }))}
                        />
                        <TextInput
                            label="目标句数"
                            type="number"
                            min={4}
                            value={createForm.targetLines}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((prev) => ({ ...prev, targetLines: Number(e.target.value) }))}
                        />
                    </div>
                    <GradientButton variant="primary" onClick={handleCreate} disabled={actionLoading} className="w-full">
                        {actionLoading ? '创建中...' : '创建房间'}
                    </GradientButton>
                </div>
            ) : null}

            <div className="space-y-2 flex-shrink-0">
                <div className="flex gap-2">
                    <input
                        value={joinCode}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="输入房间码加入"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <GradientButton variant="primary" onClick={handleJoin} disabled={actionLoading}>
                        {actionLoading ? '...' : '加入'}
                    </GradientButton>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {loading ? <p className="text-sm text-gray-500">加载中...</p> : null}
                {rooms.map((room) => (
                    <button
                        key={room.roomId}
                        type="button"
                        onClick={() => onSelectRoom(room.roomId)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${selectedRoomId === room.roomId ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white hover:border-blue-200'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">{room.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${room.mode === 'relay' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                                {room.mode === 'relay' ? '接龙' : '改编'}
                            </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {room.members.length}人 • {new Date(room.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </button>
                ))}
                {rooms.length === 0 && !loading ? (
                    <div className="text-center text-sm text-gray-500 py-4">暂无加入的房间</div>
                ) : null}
            </div>
        </aside>
    );
};
