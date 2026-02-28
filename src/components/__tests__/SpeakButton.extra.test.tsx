import { render, screen, fireEvent } from '@testing-library/react';
import { SpeakButton } from '../SpeakButton';

// We control the hook's return values entirely through the mock.
const mockSpeak = jest.fn();
const mockStop = jest.fn();
let mockIsSpeaking = false;
let mockIsSupported = true;

jest.mock('@/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    speak: mockSpeak,
    stop: mockStop,
    isSpeaking: mockIsSpeaking,
    isSupported: mockIsSupported,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsSpeaking = false;
  mockIsSupported = true;
});

describe('SpeakButton – additional coverage', () => {
  it('renders nothing when speech is not supported', () => {
    mockIsSupported = false;
    const { container } = render(<SpeakButton text="你好" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls speak() with the correct text when clicked while not speaking', () => {
    render(<SpeakButton text="超梦登场！" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSpeak).toHaveBeenCalledWith('超梦登场！');
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('calls stop() when clicked while already speaking', () => {
    mockIsSpeaking = true;
    render(<SpeakButton text="停止文本" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('shows "停止朗读" label and text when isSpeaking is true', () => {
    mockIsSpeaking = true;
    render(<SpeakButton text="任意文本" />);
    expect(screen.getByRole('button', { name: '停止朗读' })).toBeInTheDocument();
    expect(screen.getByText('停止朗读')).toBeInTheDocument();
    expect(screen.queryByText('语音朗读')).not.toBeInTheDocument();
  });

  it('shows "语音朗读" label and text when isSpeaking is false', () => {
    render(<SpeakButton text="任意文本" />);
    expect(screen.getByRole('button', { name: '朗读卡牌信息' })).toBeInTheDocument();
    expect(screen.getByText('语音朗读')).toBeInTheDocument();
    expect(screen.queryByText('停止朗读')).not.toBeInTheDocument();
  });
});
