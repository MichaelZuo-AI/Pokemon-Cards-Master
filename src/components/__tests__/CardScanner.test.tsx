import { render, screen, fireEvent } from '@testing-library/react';
import { CardScanner } from '../CardScanner';

describe('CardScanner', () => {
  it('renders upload prompt when not loading', () => {
    render(<CardScanner onFileSelected={jest.fn()} isLoading={false} preview={null} />);
    expect(screen.getByText('拍照或选择卡牌图片')).toBeInTheDocument();
  });

  it('shows loading state with preview', () => {
    render(
      <CardScanner
        onFileSelected={jest.fn()}
        isLoading={true}
        preview="data:image/jpeg;base64,abc"
      />,
    );
    expect(screen.getByText('正在识别卡牌...')).toBeInTheDocument();
    expect(screen.getByAltText('正在识别的卡牌')).toBeInTheDocument();
  });

  it('calls onFileSelected when file is chosen', () => {
    const onFileSelected = jest.fn();
    render(<CardScanner onFileSelected={onFileSelected} isLoading={false} preview={null} />);

    const file = new File(['test'], 'card.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});
