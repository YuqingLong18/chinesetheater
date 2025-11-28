import MarkdownRenderer from './MarkdownRenderer';

interface ChatBubbleProps {
  sender: 'student' | 'ai';
  content: string;
}

const ChatBubble = ({ sender, content }: ChatBubbleProps) => {
  const isStudent = sender === 'student';
  return (
    <div className={`flex ${isStudent ? 'justify-end' : 'justify-start'} py-1`}>
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isStudent
            ? 'bg-lavender-100 text-gray-800'
            : 'border border-gray-200 bg-white text-gray-800'
        }`}
      >
        <MarkdownRenderer content={content} className="markdown-bubble" />
      </div>
    </div>
  );
};

export default ChatBubble;
