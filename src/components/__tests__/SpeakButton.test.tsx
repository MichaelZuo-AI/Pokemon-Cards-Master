import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpeakButton } from '../SpeakButton';

// Mock fetch to simulate Edge TTS failure (triggers browser fallback)
global.fetch = jest.fn().mockRejectedValue(new Error('network'));

describe('SpeakButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
  });

  it('renders speak button', () => {
    render(<SpeakButton text="测试" />);
    const button = screen.getByRole('button', { name: '朗读卡牌信息' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('语音朗读')).toBeInTheDocument();
  });

  it('falls back to browser speechSynthesis on click', async () => {
    render(<SpeakButton text="测试文本" />);
    fireEvent.click(screen.getByRole('button', { name: '朗读卡牌信息' }));

    await waitFor(() => {
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });
  });
});
