'use client';

import { CardInfo } from '@/types/card';
import { SpeakButton } from './SpeakButton';

interface CardResultProps {
  cardInfo: CardInfo;
  preview: string | null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-800">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

export function CardResult({ cardInfo, preview }: CardResultProps) {
  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Card Image + Name Header */}
      <div className="flex gap-4 items-start">
        {preview && (
          <img
            src={preview}
            alt={cardInfo.nameCn}
            className="w-28 rounded-lg shadow-lg flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-yellow-400">{cardInfo.nameCn}</h2>
          <p className="text-gray-400 text-sm">
            {cardInfo.nameEn}
            {cardInfo.nameJp && ` / ${cardInfo.nameJp}`}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {cardInfo.types.map((type) => (
              <span
                key={type}
                className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium"
              >
                {type}
              </span>
            ))}
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
              HP {cardInfo.hp}
            </span>
          </div>
        </div>
      </div>

      {/* TTS Button */}
      <div className="flex justify-center">
        <SpeakButton text={cardInfo.ttsSummary} />
      </div>

      {/* Basic Info */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-0.5">
        <h3 className="text-yellow-400 font-semibold mb-2">基本信息</h3>
        <InfoRow label="阶段" value={cardInfo.stage} />
        <InfoRow label="弱点" value={cardInfo.weakness} />
        <InfoRow label="抵抗" value={cardInfo.resistance} />
        <InfoRow label="撤退费用" value={cardInfo.retreatCost} />
        <InfoRow label="稀有度" value={cardInfo.rarity} />
        <InfoRow label="系列" value={cardInfo.setName} />
        <InfoRow label="编号" value={cardInfo.cardNumber} />
      </div>

      {/* Attacks */}
      {cardInfo.attacks.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-yellow-400 font-semibold mb-3">技能</h3>
          <div className="space-y-3">
            {cardInfo.attacks.map((attack, i) => (
              <div key={i} className="border-l-2 border-yellow-500/50 pl-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-white">{attack.name}</span>
                  <span className="text-yellow-400 font-bold">{attack.damage}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{attack.energyCost}</p>
                {attack.description && (
                  <p className="text-sm text-gray-400 mt-1">{attack.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flavor Text */}
      {cardInfo.flavorText && (
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-gray-400 text-sm italic">&ldquo;{cardInfo.flavorText}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
