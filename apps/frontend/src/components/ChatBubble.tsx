interface ChatBubbleProps {
  sender: 'student' | 'ai';
  content: string;
}

const ChatBubble = ({ sender, content }: ChatBubbleProps) => {
  const isStudent = sender === 'student';
  return (
    <div className={`flex ${isStudent ? 'justify-end' : 'justify-start'} py-1`}>
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isStudent
            ? 'bg-blue-100 text-gray-800'
            : 'border border-transparent bg-white text-gray-800 shadow-md ring-1 ring-inset ring-purple-200'
        }`}
      >
        {content}
      </div>
    </div>
  );
};

export default ChatBubble;
