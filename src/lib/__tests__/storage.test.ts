import { getHistory, addScan, removeScan, clearHistory } from '../storage';
import { CardInfo } from '@/types/card';

const mockCard: CardInfo = {
  nameCn: '皮卡丘',
  nameEn: 'Pikachu',
  nameJp: 'ピカチュウ',
  introduction: '皮卡丘是最受欢迎的电属性宝可梦，脸颊上的红色电气袋能释放强力电击。',
  types: ['电'],
  hp: '60',
  stage: '基础',
  attacks: [
    { name: '十万伏特', damage: '50', energyCost: '电电', description: '强力电击' },
  ],
  weakness: '地面',
  resistance: '',
  retreatCost: '1',
  rarity: '普通',
  setName: '基础系列',
  cardNumber: '025/102',
  flavorText: '当好几只聚在一起时，就会产生强烈的电力。',
  ttsSummary: '皮卡丘，电属性，60血。技能：十万伏特，50伤害。',
};

beforeEach(() => {
  localStorage.clear();
});

describe('getHistory', () => {
  it('returns empty array when no history', () => {
    expect(getHistory()).toEqual([]);
  });

  it('returns parsed history', () => {
    const record = { id: '1', cardInfo: mockCard, thumbnail: 'thumb', timestamp: 1000 };
    localStorage.setItem('pokemon-cards-history', JSON.stringify([record]));
    expect(getHistory()).toEqual([record]);
  });

  it('returns empty array on corrupted data', () => {
    localStorage.setItem('pokemon-cards-history', 'not-json');
    expect(getHistory()).toEqual([]);
  });
});

describe('addScan', () => {
  it('adds a scan record', () => {
    const record = addScan(mockCard, 'thumb-data');
    expect(record.cardInfo).toBe(mockCard);
    expect(record.thumbnail).toBe('thumb-data');
    expect(record.id).toBeTruthy();
    expect(record.timestamp).toBeGreaterThan(0);

    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(record.id);
  });

  it('prepends new records', () => {
    addScan(mockCard, 'first');
    addScan(mockCard, 'second');

    const history = getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].thumbnail).toBe('second');
    expect(history[1].thumbnail).toBe('first');
  });

  it('caps at 50 records', () => {
    for (let i = 0; i < 55; i++) {
      addScan(mockCard, `thumb-${i}`);
    }
    expect(getHistory()).toHaveLength(50);
  });
});

describe('removeScan', () => {
  it('removes a scan by id', () => {
    const record = addScan(mockCard, 'thumb');
    expect(getHistory()).toHaveLength(1);

    removeScan(record.id);
    expect(getHistory()).toHaveLength(0);
  });

  it('does nothing for non-existent id', () => {
    addScan(mockCard, 'thumb');
    removeScan('non-existent');
    expect(getHistory()).toHaveLength(1);
  });
});

describe('clearHistory', () => {
  it('clears all history', () => {
    addScan(mockCard, 'thumb1');
    addScan(mockCard, 'thumb2');
    expect(getHistory()).toHaveLength(2);

    clearHistory();
    expect(getHistory()).toHaveLength(0);
  });
});
