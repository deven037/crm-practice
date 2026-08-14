const LETTERS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')];

interface AlphaIndexProps {
  /** Letters that actually have at least one matching record, for highlighting. */
  availableLetters: Set<string>;
  active: string;
  onSelect: (letter: string) => void;
}

/** A-Z jump index for name-heavy lists (Users, Contacts, Leads). */
export function AlphaIndex({ availableLetters, active, onSelect }: AlphaIndexProps) {
  return (
    <div className="alpha-index">
      {LETTERS.map((letter) => (
        <span
          key={letter}
          className={`alpha-index-item${active === letter ? ' active' : ''}`}
          onClick={() => (letter === 'All' || availableLetters.has(letter)) && onSelect(letter)}
          style={{ opacity: letter === 'All' || availableLetters.has(letter) ? 1 : 0.35, cursor: letter === 'All' || availableLetters.has(letter) ? 'pointer' : 'default' }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

export function firstLetterOf(name: string): string {
  const c = name.trim()[0]?.toUpperCase() ?? '';
  return /[A-Z0-9]/.test(c) ? c : '#';
}
