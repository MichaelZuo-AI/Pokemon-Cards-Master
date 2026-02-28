import { render, screen, fireEvent } from '@testing-library/react';
import { CardScanner } from '../CardScanner';

describe('CardScanner – additional edge cases', () => {
  it('shows upload prompt when isLoading is true but preview is null', () => {
    // When loading starts but no preview exists yet, show the button (not the preview overlay).
    render(
      <CardScanner onFileSelected={jest.fn()} isLoading={true} preview={null} />,
    );
    // The upload button is rendered, not the loading overlay.
    expect(screen.getByText('拍照或选择卡牌图片')).toBeInTheDocument();
    expect(screen.queryByText('正在识别卡牌...')).not.toBeInTheDocument();
  });

  it('shows upload prompt when preview exists but isLoading is false', () => {
    // preview && isLoading is the condition – false when isLoading is false.
    render(
      <CardScanner
        onFileSelected={jest.fn()}
        isLoading={false}
        preview="data:image/jpeg;base64,abc"
      />,
    );
    expect(screen.getByText('拍照或选择卡牌图片')).toBeInTheDocument();
    expect(screen.queryByText('正在识别卡牌...')).not.toBeInTheDocument();
  });

  it('does not call onFileSelected when no file is in the input', () => {
    const onFileSelected = jest.fn();
    render(<CardScanner onFileSelected={onFileSelected} isLoading={false} preview={null} />);

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [] } });

    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it('upload button is disabled while isLoading is true (no preview)', () => {
    render(
      <CardScanner onFileSelected={jest.fn()} isLoading={true} preview={null} />,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('upload button is enabled when not loading', () => {
    render(
      <CardScanner onFileSelected={jest.fn()} isLoading={false} preview={null} />,
    );
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  it('file input accepts image/* files', () => {
    render(<CardScanner onFileSelected={jest.fn()} isLoading={false} preview={null} />);
    const input = screen.getByTestId('file-input');
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('renders format hint text', () => {
    render(<CardScanner onFileSelected={jest.fn()} isLoading={false} preview={null} />);
    expect(screen.getByText('支持 JPG、PNG 格式')).toBeInTheDocument();
  });

  it('preview image is shown with correct alt text during loading', () => {
    render(
      <CardScanner
        onFileSelected={jest.fn()}
        isLoading={true}
        preview="data:image/jpeg;base64,preview"
      />,
    );
    const img = screen.getByAltText('正在识别的卡牌');
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,preview');
  });
});
