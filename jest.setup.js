require('@testing-library/jest-dom');

// Only set up browser mocks when running in jsdom environment
if (typeof window !== 'undefined') {
  // Mock SpeechSynthesis API
  const mockSpeak = jest.fn();
  const mockCancel = jest.fn();
  const mockGetVoices = jest.fn().mockReturnValue([
    { lang: 'zh-CN', name: 'Chinese', default: false },
  ]);

  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: mockGetVoices,
      speaking: false,
      paused: false,
      pending: false,
      onvoiceschanged: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    writable: true,
    configurable: true,
  });

  global.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
    text,
    lang: '',
    rate: 1,
    pitch: 1,
    volume: 1,
    voice: null,
    onend: null,
    onerror: null,
    onstart: null,
  }));

  // Mock URL.createObjectURL / revokeObjectURL
  URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = jest.fn();

  // Mock Audio
  global.Audio = jest.fn().mockImplementation(() => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    removeAttribute: jest.fn(),
    src: '',
    onended: null,
    onerror: null,
  }));

  // Mock fetch (default: resolve with audio blob)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  });
}
