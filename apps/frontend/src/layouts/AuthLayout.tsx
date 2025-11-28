import type { ReactNode } from 'react';
import Card from '../components/Card';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const AuthLayout = ({ title, subtitle, children }: AuthLayoutProps) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      </div>
      <Card className="space-y-5">{children}</Card>
    </div>
  </div>
);

export default AuthLayout;
