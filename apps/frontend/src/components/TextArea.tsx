import type { TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

const TextArea = ({ label, hint, className, ...props }: TextAreaProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <textarea
      className={clsx(
        'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400',
        'focus:border-lavender-400 focus:outline-none focus:ring-1 focus:ring-lavender-400',
        'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
    {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
  </label>
);

export default TextArea;
