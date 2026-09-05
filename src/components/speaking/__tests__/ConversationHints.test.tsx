import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationHints, ConversationHintItem } from '../ConversationHints';
import { safeLocalStorage } from '../../../utils/storage/safeLocalStorage';

const sampleHints: ConversationHintItem[] = [
  { japanese: 'はい、そうです。', romaji: 'Hai, sou desu.', uzbek: 'Ha, shunday.' },
  { japanese: 'いいえ、違います。', romaji: 'Iie, chigaimasu.', uzbek: "Yo'q, unday emas." },
  { japanese: 'わかりました。', romaji: 'Wakarimashita.', uzbek: 'Tushundim.' },
];

describe('ConversationHints Component', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('renders nothing when hints array is empty', () => {
    const { container } = render(
      <ConversationHints hints={[]} onSelectHint={vi.fn()} onSpeakText={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('defaults to OFF and displays compact toggle button', () => {
    render(<ConversationHints hints={sampleHints} onSelectHint={vi.fn()} onSpeakText={vi.fn()} />);

    // Should render the compact OFF pill button
    expect(screen.getByText('Javob namunalari:')).toBeDefined();
    expect(screen.getByText('OFF')).toBeDefined();
    expect(screen.getByText('Yoqish (ON)')).toBeDefined();

    // Full hints should NOT be visible yet
    expect(screen.queryByText('はい、そうです。')).toBeNull();
  });

  it('turns ON when user clicks the toggle button and persists in localStorage', () => {
    const onToggle = vi.fn();
    render(
      <ConversationHints
        hints={sampleHints}
        onSelectHint={vi.fn()}
        onSpeakText={vi.fn()}
        onToggleEnabled={onToggle}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: /Javob namunalari:/i });
    fireEvent.click(toggleButton);

    // Should now show the full hints
    expect(screen.getByText('はい、そうです。')).toBeDefined();
    expect(screen.getByText(/Ha, shunday\./i)).toBeDefined();
    expect(screen.getByText("O'chirish (OFF)")).toBeDefined();

    // LocalStorage and callback should be updated
    expect(safeLocalStorage.getItem('speaking_show_hints')).toBe('true');
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("can be turned OFF by clicking O'chirish (OFF)", () => {
    safeLocalStorage.setItem('speaking_show_hints', 'true');

    render(<ConversationHints hints={sampleHints} onSelectHint={vi.fn()} onSpeakText={vi.fn()} />);

    // Initial state: ON because of localStorage
    expect(screen.getByText('はい、そうです。')).toBeDefined();

    // Click O'chirish (OFF)
    const offBtn = screen.getByRole('button', { name: /O'chirish \(OFF\)/i });
    fireEvent.click(offBtn);

    // Now compact OFF pill should be shown
    expect(screen.getByText('Yoqish (ON)')).toBeDefined();
    expect(screen.queryByText('はい、そうです。')).toBeNull();
    expect(safeLocalStorage.getItem('speaking_show_hints')).toBe('false');
  });

  it('calls onSpeakText and onSelectHint when buttons are clicked', () => {
    safeLocalStorage.setItem('speaking_show_hints', 'true');
    const handleSelect = vi.fn();
    const handleSpeak = vi.fn();

    render(
      <ConversationHints
        hints={sampleHints}
        onSelectHint={handleSelect}
        onSpeakText={handleSpeak}
      />,
    );

    const speakButtons = screen.getAllByRole('button', { name: /Eshitish/i });
    fireEvent.click(speakButtons[0]);
    expect(handleSpeak).toHaveBeenCalledWith('はい、そうです。');

    const sendButtons = screen.getAllByRole('button', { name: /Aytish/i });
    fireEvent.click(sendButtons[0]);
    expect(handleSelect).toHaveBeenCalledWith('はい、そうです。');
  });
});
