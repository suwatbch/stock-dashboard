'use client';

import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const StockDetailContent = dynamic(
  () => import('@/components/StockDetailContent'),
  { ssr: false }
);

export default function StockDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const symbol = params.symbol as string;
  const stockName = searchParams.get('name') || symbol;

  return <StockDetailContent symbol={symbol} stockName={stockName} />;
}
