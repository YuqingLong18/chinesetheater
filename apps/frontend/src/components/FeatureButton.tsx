import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface FeatureButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'quaternary';
}

const FeatureButton = ({ children, active, className, variant = 'primary', ...props }: FeatureButtonProps) => (
  <button
    type="button"
    className={clsx(
      'w-full rounded-lg px-5 py-3.5 text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-lavender-300 focus:ring-offset-2',
      active 
        ? 'bg-lavender-500 text-white shadow-sm' 
        : 'bg-white text-gray-700 border border-gray-200 hover:border-lavender-300 hover:bg-lavender-50',
      className
    )}
    {...props}
  >
    {children}
  </button>
);

export default FeatureButton;
