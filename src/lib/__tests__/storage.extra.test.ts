import { getHistory, addScan, removeScan } from '../storage';
import { CardInfo } from '@/types/card';

const mockCard: CardInfo = {
  nameCn: '超梦',
  nameEn: 'Mewtwo',
  nameJp: 'ミュウツー',
  introduction: '传说中最强的宝可梦。',
  types: ['超能力'],
  hp: '120',
  stage: '基础',
  attacks: [{ name: '精神破坏', damage: '150', energyCost: '超超超', description: '' }],
  weakness: '虫',
  resistance: '',
  retreatCost: '3',
  rarity: '超稀有',
  setName: '基础系列',
  cardNumber: '150/151',
  flavorText: '',
  ttsSummary: '超梦。',
};

beforeEach(() => {
  localStorage.clear();
});

describe('addScan – additional coverage', () => {
  it('generates a unique id for each scan', () => {
    const r1 = addScan(mockCard, 'thumb1');
    const r2 = addScan(mockCard, 'thumb2');
    expect(r1.id).not.toBe(r2.id);
  });

  it('id contains a timestamp portion (numeric prefix)', () => {
    const before = Date.now();
    const record = addScan(mockCard, 'thumb');
    const after = Date.now();

    // id format: `${Date.now()}-${random}` — the prefix should be within the time window.
    const timestampPart = parseInt(record.id.split('-')[0], 10);
    expect(timestampPart).toBeGreaterThanOrEqual(before);
    expect(timestampPart).toBeLessThanOrEqual(after);
  });

  it('timestamp field reflects real time', () => {
    const before = Date.now();
    const record = addScan(mockCard, 'thumb');
    const after = Date.now();
    expect(record.timestamp).toBeGreaterThanOrEqual(before);
    expect(record.timestamp).toBeLessThanOrEqual(after);
  });

  it('persists added record to localStorage under correct key', () => {
    addScan(mockCard, 'thumb');
    const raw = localStorage.getItem('pokemon-cards-history');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].cardInfo.nameCn).toBe('超梦');
  });

  it('keeps exactly 50 records when adding the 51st', () => {
    // Fill to exactly 50.
    for (let i = 0; i < 50; i++) {
      addScan(mockCard, `thumb-${i}`);
    }
    expect(getHistory()).toHaveLength(50);

    // Adding one more should truncate to 50.
    addScan(mockCard, 'thumb-50');
    const history = getHistory();
    expect(history).toHaveLength(50);
    // The newest item should be at index 0.
    expect(history[0].thumbnail).toBe('thumb-50');
  });
});

describe('removeScan – additional coverage', () => {
  it('preserves all other records after removing one', () => {
    const r1 = addScan(mockCard, 'thumb1');
    const r2 = addScan(mockCard, 'thumb2');
    const r3 = addScan(mockCard, 'thumb3');

    removeScan(r2.id);

    const history = getHistory();
    expect(history).toHaveLength(2);
    const ids = history.map((r) => r.id);
    expect(ids).toContain(r1.id);
    expect(ids).toContain(r3.id);
    expect(ids).not.toContain(r2.id);
  });

  it('persists removal to localStorage', () => {
    const record = addScan(mockCard, 'thumb');
    removeScan(record.id);

    const raw = localStorage.getItem('pokemon-cards-history');
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(0);
  });
});

describe('getHistory – additional coverage', () => {
  it('returns records in insertion order (newest first)', () => {
    const r1 = addScan(mockCard, 'first');
    const r2 = addScan(mockCard, 'second');
    const r3 = addScan(mockCard, 'third');

    const history = getHistory();
    expect(history[0].id).toBe(r3.id);
    expect(history[1].id).toBe(r2.id);
    expect(history[2].id).toBe(r1.id);
  });
});
