'use client';

interface QuotaIndicatorProps {
  remaining: number;
  limit: number;
}

export function QuotaIndicator({ remaining, limit }: QuotaIndicatorProps) {
  const color =
    remaining === 0
      ? 'bg-red-900/60 text-red-300'
      : remaining <= 3
        ? 'bg-yellow-900/60 text-yellow-300'
        : 'bg-gray-800 text-gray-300';

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {remaining}/{limit}
    </span>
  );
}
