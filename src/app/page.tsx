'use client';

import { useState, useCallback } from 'react';
import { CardInfo } from '@/types/card';
import { useCardRecognition } from '@/hooks/useCardRecognition';
import { CardScanner } from '@/components/CardScanner';
import { CardResult } from '@/components/CardResult';
import { ScanHistory } from '@/components/ScanHistory';
import { ArrowLeftIcon, HistoryIcon, CameraIcon } from '@/components/Icons';

type View = 'scanner' | 'result' | 'history';

export default function Home() {
  const [view, setView] = useState<View>('scanner');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [selectedCard, setSelectedCard] = useState<{ cardInfo: CardInfo; thumbnail: string } | null>(null);

  const { recognizeCard, state, cardInfo, error, preview, reset } = useCardRecognition();

  const handleFileSelected = useCallback(async (file: File) => {
    setSelectedCard(null);
    await recognizeCard(file);
    setView('result');
    setHistoryRefreshKey((k) => k + 1);
  }, [recognizeCard]);

  const handleSelectFromHistory = useCallback((info: CardInfo, thumbnail: string) => {
    setSelectedCard({ cardInfo: info, thumbnail });
    setView('result');
  }, []);

  const handleBack = useCallback(() => {
    reset();
    setSelectedCard(null);
    setView('scanner');
  }, [reset]);

  const displayCardInfo = selectedCard?.cardInfo ?? cardInfo;
  const displayPreview = selectedCard?.thumbnail ?? preview;

  return (
    <main className="max-w-lg mx-auto px-4 pb-8">
      {/* Header */}
      <header className="flex items-center justify-between py-4">
        {view !== 'scanner' ? (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            aria-label="返回"
          >
            <ArrowLeftIcon />
          </button>
        ) : (
          <div className="w-10" />
        )}

        <h1 className="text-lg font-bold text-yellow-400">
          宝可梦卡牌大师
        </h1>

        {view === 'scanner' ? (
          <button
            onClick={() => setView('history')}
            className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors"
            aria-label="扫描记录"
          >
            <HistoryIcon />
          </button>
        ) : view === 'history' ? (
          <button
            onClick={() => setView('scanner')}
            className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors"
            aria-label="扫描卡牌"
          >
            <CameraIcon />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Content */}
      {view === 'scanner' && (
        <div className="mt-8">
          <CardScanner
            onFileSelected={handleFileSelected}
            isLoading={state === 'loading'}
            preview={preview}
          />
        </div>
      )}

      {view === 'result' && (
        <div className="mt-4">
          {state === 'loading' && (
            <CardScanner
              onFileSelected={handleFileSelected}
              isLoading={true}
              preview={preview}
            />
          )}

          {state === 'error' && (
            <div className="text-center py-12">
              <p className="text-red-400 font-medium">{error}</p>
              <button
                onClick={handleBack}
                className="mt-4 px-6 py-2 bg-gray-800 rounded-full text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                重新扫描
              </button>
            </div>
          )}

          {(displayCardInfo && (state === 'success' || selectedCard)) && (
            <CardResult cardInfo={displayCardInfo} preview={displayPreview} />
          )}
        </div>
      )}

      {view === 'history' && (
        <div className="mt-4">
          <ScanHistory
            onSelectCard={handleSelectFromHistory}
            refreshKey={historyRefreshKey}
          />
        </div>
      )}
    </main>
  );
}
