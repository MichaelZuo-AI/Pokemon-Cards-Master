import { render, screen, fireEvent } from '@testing-library/react';
import { SpeakButton } from '../SpeakButton';

const mockSpeak = jest.fn();
const mockStop = jest.fn();
let mockIsSpeaking = false;

jest.mock('@/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    speak: mockSpeak,
    stop: mockStop,
    isSpeaking: mockIsSpeaking,
    isSupported: true,
  }),
}));

describe('SpeakButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSpeaking = false;
  });

  it('renders speak button', () => {
    render(<SpeakButton text="测试" />);
    const button = screen.getByRole('button', { name: '朗读卡牌信息' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('语音朗读')).toBeInTheDocument();
  });

  it('calls speak on click', () => {
    render(<SpeakButton text="测试文本" />);
    fireEvent.click(screen.getByRole('button', { name: '朗读卡牌信息' }));
    expect(mockSpeak).toHaveBeenCalledWith('测试文本');
  });

  it('calls stop when clicked while speaking', () => {
    mockIsSpeaking = true;
    render(<SpeakButton text="测试" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});
