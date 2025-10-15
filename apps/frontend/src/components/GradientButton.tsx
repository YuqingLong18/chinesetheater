import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary';
  children: ReactNode;
}

const variantClasses: Record<Required<GradientButtonProps>['variant'], string> = {
  primary: 'gradient-button gradient-button-primary',
  secondary: 'gradient-button gradient-button-secondary',
  tertiary: 'gradient-button gradient-button-tertiary'
};

const GradientButton = ({ variant = 'primary', children, className, ...props }: GradientButtonProps) => (
  <button type="button" className={clsx(variantClasses[variant], className)} {...props}>
    {children}
  </button>
);

export default GradientButton;
