'use client';

import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { SpeakerIcon, StopIcon } from './Icons';

interface SpeakButtonProps {
  text: string;
}

export function SpeakButton({ text }: SpeakButtonProps) {
  const { speak, stop, isSpeaking, isSupported } = useSpeechSynthesis();

  if (!isSupported) return null;

  const handleClick = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
        isSpeaking
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
      }`}
      aria-label={isSpeaking ? '停止朗读' : '朗读卡牌信息'}
    >
      {isSpeaking ? (
        <>
          <StopIcon className="w-5 h-5" />
          停止朗读
        </>
      ) : (
        <>
          <SpeakerIcon className="w-5 h-5" />
          语音朗读
        </>
      )}
    </button>
  );
}
