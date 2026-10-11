import type { ReactNode } from 'react';

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  return <div className="marketing-site">{children}</div>;
}
