import { ReactNode } from 'react';
import { Modal } from './Modal';

interface ChoiceOption {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onSelect: () => void;
}

interface ChoiceModalProps {
  title: string;
  onClose: () => void;
  options: [ChoiceOption, ChoiceOption];
}

/** Two-option "create from scratch vs. from existing" decision modal. */
export function ChoiceModal({ title, onClose, options }: ChoiceModalProps) {
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="choice-grid">
        {options.map((opt) => (
          <div className="choice-card" key={opt.title}>
            <span className="choice-icon">{opt.icon}</span>
            <strong>{opt.title}</strong>
            <p>{opt.description}</p>
            <button className="btn btn-primary" onClick={opt.onSelect}>
              {opt.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
