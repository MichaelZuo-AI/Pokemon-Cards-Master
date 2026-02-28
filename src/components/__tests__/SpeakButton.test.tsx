import { render, screen, fireEvent } from '@testing-library/react';
import { SpeakButton } from '../SpeakButton';

describe('SpeakButton', () => {
  it('renders speak button', () => {
    render(<SpeakButton text="测试" />);
    const button = screen.getByRole('button', { name: '朗读卡牌信息' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('语音朗读')).toBeInTheDocument();
  });

  it('calls speechSynthesis on click', () => {
    render(<SpeakButton text="测试文本" />);
    fireEvent.click(screen.getByRole('button', { name: '朗读卡牌信息' }));
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
