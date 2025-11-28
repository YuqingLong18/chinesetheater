import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary';
  children: ReactNode;
}

const variantClasses: Record<Required<GradientButtonProps>['variant'], string> = {
  primary: 'bg-lavender-500 text-white hover:bg-lavender-600 active:bg-lavender-700 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'bg-white text-lavender-600 border border-lavender-200 hover:bg-lavender-50 hover:border-lavender-300 active:bg-lavender-100 disabled:opacity-50 disabled:cursor-not-allowed',
  tertiary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
};

const GradientButton = ({ variant = 'primary', children, className, ...props }: GradientButtonProps) => (
  <button 
    type="button" 
    className={clsx(
      'font-medium rounded-lg py-2.5 px-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-lavender-300 focus:ring-offset-2',
      variantClasses[variant], 
      className
    )} 
    {...props}
  >
    {children}
  </button>
);

export default GradientButton;
