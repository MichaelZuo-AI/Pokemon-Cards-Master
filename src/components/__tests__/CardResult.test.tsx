import { render, screen } from '@testing-library/react';
import { CardResult } from '../CardResult';
import { CardInfo } from '@/types/card';

const mockCard: CardInfo = {
  nameCn: '喷火龙',
  nameEn: 'Charizard',
  nameJp: 'リザードン',
  types: ['火', '飞行'],
  hp: '120',
  stage: '二阶',
  attacks: [
    { name: '火焰旋涡', damage: '100', energyCost: '火火无无', description: '丢弃2个火能量。' },
  ],
  weakness: '水',
  resistance: '草',
  retreatCost: '3',
  rarity: '稀有闪卡',
  setName: '基础系列',
  cardNumber: '004/102',
  flavorText: '用翅膀飞向天空。',
  ttsSummary: '喷火龙，火飞行属性。',
};

describe('CardResult', () => {
  it('renders card name in Chinese', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText('喷火龙')).toBeInTheDocument();
  });

  it('renders English and Japanese names', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText('Charizard / リザードン')).toBeInTheDocument();
  });

  it('renders types', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText('火')).toBeInTheDocument();
    expect(screen.getByText('飞行')).toBeInTheDocument();
  });

  it('renders HP', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText('HP 120')).toBeInTheDocument();
  });

  it('renders attacks', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText('火焰旋涡')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders flavor text', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText(/用翅膀飞向天空/)).toBeInTheDocument();
  });

  it('renders speak button', () => {
    render(<CardResult cardInfo={mockCard} preview={null} />);
    expect(screen.getByText('语音朗读')).toBeInTheDocument();
  });

  it('renders preview image when provided', () => {
    render(<CardResult cardInfo={mockCard} preview="data:image/jpeg;base64,abc" />);
    const img = screen.getByAltText('喷火龙');
    expect(img).toBeInTheDocument();
  });
});
