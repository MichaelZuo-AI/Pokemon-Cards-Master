import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Home from '../page';

// ---------------------------------------------------------------------------
// Mock child components so we can exercise page.tsx logic in isolation without
// depending on their full implementation details.
// ---------------------------------------------------------------------------
jest.mock('@/components/CardScanner', () => ({
  CardScanner: ({
    onFileSelected,
    isLoading,
    preview,
  }: {
    onFileSelected: (file: File) => void;
    isLoading: boolean;
    preview: string | null;
  }) => (
    <div data-testid="card-scanner" data-loading={String(isLoading)} data-preview={preview ?? ''}>
      <button
        data-testid="trigger-file"
        onClick={() => onFileSelected(new File(['img'], 'card.jpg', { type: 'image/jpeg' }))}
      >
        Select File
      </button>
    </div>
  ),
}));

jest.mock('@/components/CardResult', () => ({
  CardResult: ({
    cardInfo,
    preview,
  }: {
    cardInfo: { nameCn: string };
    preview: string | null;
  }) => (
    <div data-testid="card-result" data-preview={preview ?? ''}>
      <span data-testid="result-name">{cardInfo.nameCn}</span>
    </div>
  ),
}));

jest.mock('@/components/ScanHistory', () => ({
  ScanHistory: ({
    onSelectCard,
    refreshKey,
  }: {
    onSelectCard: (info: { nameCn: string }, thumbnail: string) => void;
    refreshKey: number;
  }) => (
    <div data-testid="scan-history" data-refresh-key={refreshKey}>
      <button
        data-testid="select-from-history"
        onClick={() =>
          onSelectCard(
            {
              nameCn: '历史卡牌',
              nameEn: 'HistoryCard',
              nameJp: 'ヒストリー',
              introduction: '来自历史记录',
              types: ['水'],
              hp: '80',
              stage: '基础',
              attacks: [],
              weakness: '电',
              resistance: '',
              retreatCost: '1',
              rarity: '普通',
              setName: '系列A',
              cardNumber: '001/100',
              flavorText: '',
              ttsSummary: '历史卡牌。',
            },
            'thumb-data-url',
          )
        }
      >
        Pick History Card
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock useCardRecognition so we can control state / trigger transitions.
// ---------------------------------------------------------------------------
const mockRecognizeCard = jest.fn();
const mockReset = jest.fn();

let mockState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
let mockCardInfo: object | null = null;
let mockError: string | null = null;
let mockPreview: string | null = null;

jest.mock('@/hooks/useCardRecognition', () => ({
  useCardRecognition: () => ({
    recognizeCard: mockRecognizeCard,
    state: mockState,
    cardInfo: mockCardInfo,
    error: mockError,
    preview: mockPreview,
    reset: mockReset,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderHome() {
  return render(<Home />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = 'idle';
  mockCardInfo = null;
  mockError = null;
  mockPreview = null;

  // recognizeCard resolves immediately by default (stays in idle for unit tests
  // that don't need the loading→success transition; individual tests override).
  mockRecognizeCard.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Initial render
// ---------------------------------------------------------------------------
describe('Home page – initial render', () => {
  it('renders the app title', () => {
    renderHome();
    expect(screen.getByText('宝可梦卡牌大师')).toBeInTheDocument();
  });

  it('shows the scanner view by default', () => {
    renderHome();
    expect(screen.getByTestId('card-scanner')).toBeInTheDocument();
    expect(screen.queryByTestId('card-result')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scan-history')).not.toBeInTheDocument();
  });

  it('shows the history button (not a back button) in scanner view', () => {
    renderHome();
    expect(screen.getByRole('button', { name: '扫描记录' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// View navigation
// ---------------------------------------------------------------------------
describe('Home page – view navigation', () => {
  it('switches to history view when history button is clicked', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    expect(screen.getByTestId('scan-history')).toBeInTheDocument();
    expect(screen.queryByTestId('card-scanner')).not.toBeInTheDocument();
  });

  it('shows camera button and back button in history view', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    expect(screen.getByRole('button', { name: '扫描卡牌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
  });

  it('returns to scanner view from history via camera button', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    fireEvent.click(screen.getByRole('button', { name: '扫描卡牌' }));
    expect(screen.getByTestId('card-scanner')).toBeInTheDocument();
    expect(screen.queryByTestId('scan-history')).not.toBeInTheDocument();
  });

  it('back button in result view calls reset and returns to scanner', async () => {
    // Simulate a completed recognition so we land in result view.
    mockState = 'success';
    mockCardInfo = {
      nameCn: '皮卡丘', nameEn: 'Pikachu', nameJp: 'ピカチュウ',
      introduction: '简介', types: ['电'], hp: '60', stage: '基础',
      attacks: [], weakness: '地面', resistance: '', retreatCost: '1',
      rarity: '普通', setName: '基础系列', cardNumber: '025/102',
      flavorText: '', ttsSummary: '皮卡丘。',
    };

    renderHome();

    // Trigger file selection to move to result view.
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    // Now in result view.
    expect(screen.getByTestId('card-result')).toBeInTheDocument();

    // Click back.
    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('card-scanner')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// File selection and recognition flow
// ---------------------------------------------------------------------------
describe('Home page – file recognition flow', () => {
  it('calls recognizeCard with the selected file', async () => {
    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    expect(mockRecognizeCard).toHaveBeenCalledTimes(1);
    const [calledFile] = mockRecognizeCard.mock.calls[0];
    expect(calledFile).toBeInstanceOf(File);
    expect(calledFile.name).toBe('card.jpg');
  });

  it('navigates to result view after file is selected', async () => {
    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    // Result view should now be rendered (even during loading state).
    expect(screen.queryByTestId('card-scanner')).not.toBeInTheDocument();
  });

  it('increments historyRefreshKey after successful scan (passed to ScanHistory)', async () => {
    renderHome();

    // First scan.
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    // Navigate to history to check refreshKey.
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    expect(screen.getByTestId('scan-history')).toHaveAttribute('data-refresh-key', '1');
  });
});

// ---------------------------------------------------------------------------
// Result view states
// ---------------------------------------------------------------------------
describe('Home page – result view states', () => {
  it('shows CardResult when state is success and cardInfo is available', async () => {
    mockState = 'success';
    mockCardInfo = {
      nameCn: '超梦', nameEn: 'Mewtwo', nameJp: 'ミュウツー',
      introduction: '简介', types: ['超能力'], hp: '120', stage: '基础',
      attacks: [], weakness: '虫', resistance: '', retreatCost: '3',
      rarity: '超稀有', setName: '系列', cardNumber: '150/151',
      flavorText: '', ttsSummary: '超梦。',
    };

    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    expect(screen.getByTestId('card-result')).toBeInTheDocument();
    expect(screen.getByTestId('result-name')).toHaveTextContent('超梦');
  });

  it('shows error message and retry button when state is error', async () => {
    mockState = 'error';
    mockError = '识别失败，请重试';

    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    expect(screen.getByText('识别失败，请重试')).toBeInTheDocument();
    expect(screen.getByText('重新扫描')).toBeInTheDocument();
    expect(screen.queryByTestId('card-result')).not.toBeInTheDocument();
  });

  it('retry button in error state calls reset and returns to scanner', async () => {
    mockState = 'error';
    mockError = '识别失败';

    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    fireEvent.click(screen.getByText('重新扫描'));

    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByTestId('card-scanner')).toBeInTheDocument();
  });

  it('shows loading CardScanner when state is loading in result view', async () => {
    mockState = 'loading';
    mockPreview = 'data:image/jpeg;base64,preview';

    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    // In result view with loading state, CardScanner is rendered with isLoading=true.
    const scanner = screen.getByTestId('card-scanner');
    expect(scanner).toBeInTheDocument();
    expect(scanner).toHaveAttribute('data-loading', 'true');
  });
});

// ---------------------------------------------------------------------------
// Selecting a card from history
// ---------------------------------------------------------------------------
describe('Home page – history card selection', () => {
  it('navigates to result view when a history card is selected', () => {
    renderHome();

    // Go to history view.
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    expect(screen.getByTestId('scan-history')).toBeInTheDocument();

    // Select a card from history.
    fireEvent.click(screen.getByTestId('select-from-history'));

    // Should now show result view with the history card.
    expect(screen.getByTestId('card-result')).toBeInTheDocument();
    expect(screen.getByTestId('result-name')).toHaveTextContent('历史卡牌');
  });

  it('passes thumbnail as preview when showing a history card', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    fireEvent.click(screen.getByTestId('select-from-history'));

    const result = screen.getByTestId('card-result');
    expect(result).toHaveAttribute('data-preview', 'thumb-data-url');
  });

  it('back button clears selected history card and returns to scanner', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    fireEvent.click(screen.getByTestId('select-from-history'));

    expect(screen.getByTestId('card-result')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByTestId('card-scanner')).toBeInTheDocument();
    // After back, selectedCard is cleared; a fresh scan would show live cardInfo not history card.
  });

  it('selecting a history card does not call recognizeCard', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '扫描记录' }));
    fireEvent.click(screen.getByTestId('select-from-history'));
    expect(mockRecognizeCard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Header rendering per view
// ---------------------------------------------------------------------------
describe('Home page – header buttons per view', () => {
  it('result view shows a back button but no history/camera buttons in header', async () => {
    mockState = 'success';
    mockCardInfo = {
      nameCn: '杰尼龟', nameEn: 'Squirtle', nameJp: 'ゼニガメ',
      introduction: '简介', types: ['水'], hp: '40', stage: '基础',
      attacks: [], weakness: '草', resistance: '', retreatCost: '1',
      rarity: '普通', setName: '基础系列', cardNumber: '007/102',
      flavorText: '', ttsSummary: '杰尼龟。',
    };
    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-file'));
    });

    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '扫描记录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '扫描卡牌' })).not.toBeInTheDocument();
  });
});
