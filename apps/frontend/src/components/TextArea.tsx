import type { TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

const TextArea = ({ label, hint, className, ...props }: TextAreaProps) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
    <span>{label}</span>
    <textarea
      className={clsx(
        'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200',
        className
      )}
      {...props}
    />
    {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
  </label>
);

export default TextArea;
