import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface FeatureButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'primary' | 'secondary' | 'tertiary';
}

const variantMap: Record<Required<FeatureButtonProps>['variant'], string> = {
  primary: 'from-blue-500 to-purple-600',
  secondary: 'from-green-400 to-blue-500',
  tertiary: 'from-pink-500 to-orange-400'
};

const FeatureButton = ({ children, active, className, variant = 'primary', ...props }: FeatureButtonProps) => (
  <button
    type="button"
    className={clsx(
      'w-full rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-lg transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
      `bg-gradient-to-r ${variantMap[variant]}`,
      active ? 'scale-100' : 'scale-95 opacity-90 hover:scale-100',
      className
    )}
    {...props}
  >
    {children}
  </button>
);

export default FeatureButton;
