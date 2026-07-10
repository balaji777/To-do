import "@testing-library/jest-dom/vitest";

beforeEach(() => {
  localStorage.clear();
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn(),
        renderButton: vi.fn(),
      },
    },
  };
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
