'use client';

import { useRef } from 'react';
import { CameraIcon, SpinnerIcon } from './Icons';

interface CardScannerProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  preview: string | null;
}

export function CardScanner({ onFileSelected, isLoading, preview }: CardScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        data-testid="file-input"
      />

      {preview && isLoading ? (
        <div className="relative w-full max-w-xs aspect-[2.5/3.5] rounded-xl overflow-hidden">
          <img
            src={preview}
            alt="正在识别的卡牌"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <SpinnerIcon className="w-12 h-12 text-yellow-400" />
            <p className="mt-3 text-yellow-400 font-medium">正在识别卡牌...</p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="flex flex-col items-center justify-center w-full max-w-xs aspect-[2.5/3.5] rounded-xl border-2 border-dashed border-gray-600 hover:border-yellow-500 hover:bg-yellow-500/5 transition-all group"
        >
          <CameraIcon className="w-16 h-16 text-gray-500 group-hover:text-yellow-500 transition-colors" />
          <p className="mt-4 text-gray-400 group-hover:text-yellow-500 font-medium transition-colors">
            拍照或选择卡牌图片
          </p>
          <p className="mt-1 text-xs text-gray-600">
            支持 JPG、PNG 格式
          </p>
        </button>
      )}
    </div>
  );
}
