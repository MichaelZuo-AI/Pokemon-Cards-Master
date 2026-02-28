import { render, screen, fireEvent } from '@testing-library/react';
import { ScanHistory } from '../ScanHistory';
import { ScanRecord } from '@/types/card';

const makeRecord = (id: string, nameCn: string): ScanRecord => ({
  id,
  cardInfo: {
    nameCn,
    nameEn: 'Name',
    nameJp: 'ネーム',
    introduction: '简介',
    types: ['电'],
    hp: '60',
    stage: '基础',
    attacks: [],
    weakness: '地面',
    resistance: '',
    retreatCost: '1',
    rarity: '普通',
    setName: '系列',
    cardNumber: `${id}/100`,
    flavorText: '',
    ttsSummary: `${nameCn}。`,
  },
  thumbnail: `thumb-${id}`,
  timestamp: Date.now(),
});

describe('ScanHistory – additional coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes a single record when its delete button is clicked', () => {
    const records = [makeRecord('1', '皮卡丘'), makeRecord('2', '喷火龙')];
    localStorage.setItem('pokemon-cards-history', JSON.stringify(records));

    render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);

    expect(screen.getByText('皮卡丘')).toBeInTheDocument();
    expect(screen.getByText('喷火龙')).toBeInTheDocument();

    // Click the delete button for 皮卡丘 (first record).
    const deleteButton = screen.getByRole('button', { name: '删除 皮卡丘' });
    fireEvent.click(deleteButton);

    expect(screen.queryByText('皮卡丘')).not.toBeInTheDocument();
    expect(screen.getByText('喷火龙')).toBeInTheDocument();
    // Count updates
    expect(screen.getByText('扫描记录 (1)')).toBeInTheDocument();
  });

  it('delete click does not propagate to parent card click handler', () => {
    const onSelectCard = jest.fn();
    const records = [makeRecord('1', '皮卡丘')];
    localStorage.setItem('pokemon-cards-history', JSON.stringify(records));

    render(<ScanHistory onSelectCard={onSelectCard} refreshKey={0} />);

    const deleteButton = screen.getByRole('button', { name: '删除 皮卡丘' });
    fireEvent.click(deleteButton);

    // onSelectCard should NOT be called because e.stopPropagation() is used.
    expect(onSelectCard).not.toHaveBeenCalled();
  });

  it('reloads history when refreshKey changes', () => {
    // Start with empty history.
    const { rerender } = render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);
    expect(screen.getByText('还没有扫描记录')).toBeInTheDocument();

    // Add a record to storage and rerender with a new refreshKey.
    const records = [makeRecord('1', '超梦')];
    localStorage.setItem('pokemon-cards-history', JSON.stringify(records));

    rerender(<ScanHistory onSelectCard={jest.fn()} refreshKey={1} />);

    expect(screen.getByText('超梦')).toBeInTheDocument();
  });

  it('pressing Enter on a history card calls onSelectCard', () => {
    const onSelectCard = jest.fn();
    const records = [makeRecord('1', '妙蛙种子')];
    localStorage.setItem('pokemon-cards-history', JSON.stringify(records));

    render(<ScanHistory onSelectCard={onSelectCard} refreshKey={0} />);

    // The history cards use role="button" with tabIndex — find via closest.
    const cardDiv = screen.getByText('妙蛙种子').closest('[role="button"]');
    expect(cardDiv).not.toBeNull();

    fireEvent.keyDown(cardDiv!, { key: 'Enter' });
    expect(onSelectCard).toHaveBeenCalledWith(records[0].cardInfo, records[0].thumbnail);
  });

  it('pressing other keys does not call onSelectCard', () => {
    const onSelectCard = jest.fn();
    const records = [makeRecord('1', '妙蛙种子')];
    localStorage.setItem('pokemon-cards-history', JSON.stringify(records));

    render(<ScanHistory onSelectCard={onSelectCard} refreshKey={0} />);

    const cardDiv = screen.getByText('妙蛙种子').closest('[role="button"]');
    fireEvent.keyDown(cardDiv!, { key: 'Space' });

    expect(onSelectCard).not.toHaveBeenCalled();
  });

  it('shows secondary empty-state hint text', () => {
    render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);
    expect(screen.getByText('拍照识别第一张卡牌吧!')).toBeInTheDocument();
  });

  it('renders thumbnail images for each record', () => {
    const records = [makeRecord('1', '皮卡丘'), makeRecord('2', '喷火龙')];
    localStorage.setItem('pokemon-cards-history', JSON.stringify(records));

    render(<ScanHistory onSelectCard={jest.fn()} refreshKey={0} />);

    const imgs = screen.getAllByRole('img');
    const srcs = imgs.map((img) => img.getAttribute('src'));
    expect(srcs).toContain('thumb-1');
    expect(srcs).toContain('thumb-2');
  });
});
