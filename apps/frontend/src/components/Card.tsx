import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
}

const Card = ({ children, className }: CardProps) => (
  <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>{children}</div>
);

export default Card;
