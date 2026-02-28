export interface Attack {
  name: string;
  damage: string;
  energyCost: string;
  description: string;
}

export interface CardInfo {
  nameCn: string;
  nameEn: string;
  nameJp: string;
  types: string[];
  hp: string;
  stage: string;
  attacks: Attack[];
  weakness: string;
  resistance: string;
  retreatCost: string;
  rarity: string;
  setName: string;
  cardNumber: string;
  flavorText: string;
  ttsSummary: string;
}

export interface ScanRecord {
  id: string;
  cardInfo: CardInfo;
  thumbnail: string;
  timestamp: number;
}

export type RecognitionState = 'idle' | 'loading' | 'success' | 'error';
