'use client';

import { useState, useEffect } from 'react';
import { ScanRecord, CardInfo } from '@/types/card';
import { getHistory, removeScan, clearHistory } from '@/lib/storage';
import { TrashIcon } from './Icons';

interface ScanHistoryProps {
  onSelectCard: (cardInfo: CardInfo, thumbnail: string) => void;
  refreshKey: number;
}

export function ScanHistory({ onSelectCard, refreshKey }: ScanHistoryProps) {
  const [history, setHistory] = useState<ScanRecord[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, [refreshKey]);

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeScan(id);
    setHistory(getHistory());
  };

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">还没有扫描记录</p>
        <p className="text-gray-600 text-sm mt-1">拍照识别第一张卡牌吧!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-gray-300 font-semibold">
          扫描记录 ({history.length})
        </h3>
        <button
          onClick={handleClear}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          清空记录
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {history.map((record) => (
          <div
            key={record.id}
            className="group relative rounded-lg overflow-hidden bg-gray-900 hover:ring-2 hover:ring-yellow-500 transition-all cursor-pointer"
            onClick={() => onSelectCard(record.cardInfo, record.thumbnail)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectCard(record.cardInfo, record.thumbnail); }}
          >
            <img
              src={record.thumbnail}
              alt={record.cardInfo.nameCn}
              className="w-full aspect-[2.5/3.5] object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
              <p className="text-xs text-white truncate font-medium">
                {record.cardInfo.nameCn}
              </p>
            </div>
            <button
              onClick={(e) => handleRemove(e, record.id)}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              aria-label={`删除 ${record.cardInfo.nameCn}`}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
