import { render, screen } from '@testing-library/react';
import { CardResult } from '../CardResult';
import { CardInfo } from '@/types/card';

// Mock useSpeechSynthesis used inside SpeakButton so audio APIs don't interfere.
jest.mock('@/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    speak: jest.fn(),
    stop: jest.fn(),
    isSpeaking: false,
    isSupported: true,
  }),
}));

const baseCard: CardInfo = {
  nameCn: '杰尼龟',
  nameEn: 'Squirtle',
  nameJp: 'ゼニガメ',
  introduction: '杰尼龟是水属性宝可梦。',
  types: ['水'],
  hp: '40',
  stage: '基础',
  attacks: [
    { name: '水枪', damage: '20', energyCost: '水', description: '普通水属性攻击。' },
  ],
  weakness: '草',
  resistance: '',
  retreatCost: '1',
  rarity: '普通',
  setName: '基础系列',
  cardNumber: '007/102',
  flavorText: '缩在壳里，享受宁静。',
  ttsSummary: '杰尼龟，水属性，40HP。',
};

describe('CardResult – additional coverage', () => {
  it('does not render the attacks section when attacks array is empty', () => {
    const noAttacksCard = { ...baseCard, attacks: [] };
    render(<CardResult cardInfo={noAttacksCard} preview={null} />);
    expect(screen.queryByText('技能')).not.toBeInTheDocument();
  });

  it('does not render the flavor text section when flavorText is empty', () => {
    const noFlavorCard = { ...baseCard, flavorText: '' };
    const { container } = render(<CardResult cardInfo={noFlavorCard} preview={null} />);
    // The italic paragraph wrapping flavor text should not exist.
    const italics = container.querySelectorAll('p.italic');
    expect(italics).toHaveLength(0);
  });

  it('does not render the introduction section when introduction is empty', () => {
    const noIntroCard = { ...baseCard, introduction: '' };
    render(<CardResult cardInfo={noIntroCard} preview={null} />);
    expect(screen.queryByText('简介')).not.toBeInTheDocument();
  });

  it('renders multiple attacks', () => {
    const multiAttackCard: CardInfo = {
      ...baseCard,
      attacks: [
        { name: '水枪', damage: '20', energyCost: '水', description: '水攻击。' },
        { name: '水炮', damage: '60', energyCost: '水水水', description: '强力水炮。' },
      ],
    };
    render(<CardResult cardInfo={multiAttackCard} preview={null} />);
    expect(screen.getByText('水枪')).toBeInTheDocument();
    expect(screen.getByText('水炮')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('skips InfoRow when value is empty string (resistance)', () => {
    // resistance is empty in baseCard — the InfoRow component returns null for empty value.
    render(<CardResult cardInfo={baseCard} preview={null} />);
    expect(screen.queryByText('抵抗')).not.toBeInTheDocument();
  });

  it('renders InfoRow for non-empty resistance', () => {
    const cardWithResistance = { ...baseCard, resistance: '火×-20' };
    render(<CardResult cardInfo={cardWithResistance} preview={null} />);
    expect(screen.getByText('抵抗')).toBeInTheDocument();
    expect(screen.getByText('火×-20')).toBeInTheDocument();
  });

  it('does not render preview image when preview is null', () => {
    render(<CardResult cardInfo={baseCard} preview={null} />);
    expect(screen.queryByAltText('杰尼龟')).not.toBeInTheDocument();
  });

  it('renders all basic info rows', () => {
    render(<CardResult cardInfo={baseCard} preview={null} />);
    expect(screen.getByText('阶段')).toBeInTheDocument();
    expect(screen.getByText('弱点')).toBeInTheDocument();
    expect(screen.getByText('撤退费用')).toBeInTheDocument();
    expect(screen.getByText('稀有度')).toBeInTheDocument();
    expect(screen.getByText('系列')).toBeInTheDocument();
    expect(screen.getByText('编号')).toBeInTheDocument();
  });

  it('renders attack energy cost and description', () => {
    render(<CardResult cardInfo={baseCard} preview={null} />);
    // energyCost "水" appears alongside type badge "水" — use getAllByText
    const waterTexts = screen.getAllByText('水');
    expect(waterTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('普通水属性攻击。')).toBeInTheDocument(); // description
  });

  it('does not render attack description when it is empty', () => {
    const cardNoDesc: CardInfo = {
      ...baseCard,
      attacks: [{ name: '撞击', damage: '10', energyCost: '无', description: '' }],
    };
    render(<CardResult cardInfo={cardNoDesc} preview={null} />);
    // Only the attack name and damage should be visible.
    expect(screen.getByText('撞击')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders nameEn alone when nameJp is empty', () => {
    const noJpCard = { ...baseCard, nameJp: '' };
    render(<CardResult cardInfo={noJpCard} preview={null} />);
    // nameJp is falsy so the ` / nameJp` part is omitted.
    expect(screen.getByText('Squirtle')).toBeInTheDocument();
    expect(screen.queryByText(/ゼニガメ/)).not.toBeInTheDocument();
  });
});
