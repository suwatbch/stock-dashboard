'use client';

import dynamic from 'next/dynamic';

const DashboardContent = dynamic(
  () => import('@/components/stock/DashboardContent'),
  { ssr: false }
);

export default function Home() {
  return <DashboardContent />;
}
