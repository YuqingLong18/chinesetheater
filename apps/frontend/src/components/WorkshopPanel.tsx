import { useState } from 'react';
import { useWorkshop } from '../hooks/useWorkshop';
import { useAuthStore } from '../store/authStore';
import type { StudentTask } from '../types';
import { WorkshopRoomList } from './workshop/WorkshopRoomList';
import { WorkshopRelayView } from './workshop/WorkshopRelayView';
import { WorkshopAdaptationView } from './workshop/WorkshopAdaptationView';

interface WorkshopPanelProps {
  tasks?: StudentTask[];
  onSubmitTask?: (taskId: number, payload: Record<string, unknown>) => Promise<void>;
  submittingTaskId?: number | null;
}

const WorkshopPanel = ({ tasks = [], onSubmitTask, submittingTaskId }: WorkshopPanelProps) => {
  const [showRoomsPanel, setShowRoomsPanel] = useState(true);
  const { studentProfile, teacherProfile } = useAuthStore();

  const {
    rooms,
    selectedRoom,
    selectedRoomId,
    setSelectedRoomId,
    loadingRooms,
    createRoom,
    joinRoom,
    myMember,
    actions
  } = useWorkshop();

  const handleJoin = async (code: string) => {
    const nickname = (studentProfile ?? teacherProfile)?.username ?? 'Unknown';
    await joinRoom(code, nickname);
  };

  return (
    <div className={`grid gap-6 h-[calc(100vh-140px)] ${showRoomsPanel ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : 'lg:grid-cols-[0px_minmax(0,1fr)]'} transition-all duration-300`}>
      {/* Sidebar - conditionally hidden */}
      <div className={`${showRoomsPanel ? 'block' : 'hidden lg:block lg:w-0 lg:overflow-hidden'}`}>
        <WorkshopRoomList
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          onCreateRoom={createRoom}
          onJoinRoom={handleJoin}
          onClose={() => setShowRoomsPanel(false)}
          loading={loadingRooms}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm relative">

        {/* Toggle Button if sidebar hidden */}
        {!showRoomsPanel && (
          <button
            onClick={() => setShowRoomsPanel(true)}
            className="absolute top-4 left-4 z-10 bg-white/80 p-2 rounded-full shadow-sm hover:bg-white border border-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="9" x2="9" y1="3" y2="21" /></svg>
          </button>
        )}

        {selectedRoom ? (
          selectedRoom.mode === 'relay' ? (
            <WorkshopRelayView
              room={selectedRoom}
              myMember={myMember}
              actions={{
                submitContribution: actions.submitContribution,
                sendChat: actions.sendChat,
                vote: actions.castVote
              }}
            />
          ) : (
            <WorkshopAdaptationView room={selectedRoom} myMember={myMember} actions={actions} />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z" /><path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8" /><path d="M15 2v5h5" /></svg>
            <p>请选择或创建一个创作房间</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkshopPanel;
