import { render, screen, fireEvent } from '@testing-library/react';
import { ScanHistory } from '../ScanHistory';

const mockRecord = {
  id: 'test-1',
  cardInfo: {
    nameCn: '皮卡丘',
    nameEn: 'Pikachu',
    nameJp: 'ピカチュウ',
    introduction: '皮卡丘是最受欢迎的电属性宝可梦。',
    types: ['电'],
    hp: '60',
    stage: '基础',
    attacks: [],
    weakness: '地面',
    resistance: '',
    retreatCost: '1',
    rarity: '普通',
    setName: '基础系列',
    cardNumber: '025/102',
    flavorText: '',
    ttsSummary: '皮卡丘',
  },
  thumbnail: 'data:image/jpeg;base64,thumb',
  timestamp: Date.now(),
};

describe('ScanHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows empty state when no history', () => {
    render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);
    expect(screen.getByText('还没有扫描记录')).toBeInTheDocument();
  });

  it('renders history records', () => {
    localStorage.setItem('pokemon-cards-history', JSON.stringify([mockRecord]));
    render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);
    expect(screen.getByText('皮卡丘')).toBeInTheDocument();
    expect(screen.getByText('扫描记录 (1)')).toBeInTheDocument();
  });

  it('calls onSelectCard when clicking a record', () => {
    localStorage.setItem('pokemon-cards-history', JSON.stringify([mockRecord]));
    const onSelectCard = jest.fn();
    render(<ScanHistory onSelectCard={onSelectCard} refreshKey={0} />);

    fireEvent.click(screen.getByText('皮卡丘'));
    expect(onSelectCard).toHaveBeenCalledWith(mockRecord.cardInfo, mockRecord.thumbnail);
  });

  it('clears history when clicking clear button', () => {
    localStorage.setItem('pokemon-cards-history', JSON.stringify([mockRecord]));
    render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);

    fireEvent.click(screen.getByText('清空记录'));
    expect(screen.getByText('还没有扫描记录')).toBeInTheDocument();
  });
});
