import { ScanRecord, CardInfo } from '@/types/card';

const STORAGE_KEY = 'pokemon-cards-history';
const MAX_RECORDS = 50;

export function getHistory(): ScanRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanRecord[];
  } catch {
    return [];
  }
}

export function addScan(cardInfo: CardInfo, thumbnail: string): ScanRecord {
  const record: ScanRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cardInfo,
    thumbnail,
    timestamp: Date.now(),
  };

  const history = getHistory();
  history.unshift(record);

  // Cap at MAX_RECORDS
  if (history.length > MAX_RECORDS) {
    history.length = MAX_RECORDS;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // QuotaExceededError — trim older records and retry
    history.length = Math.min(history.length, 20);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage completely full, skip persisting
    }
  }
  return record;
}

export function removeScan(id: string): void {
  const history = getHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore write errors on removal
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
