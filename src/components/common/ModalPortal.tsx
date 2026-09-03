import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  backdropClassName = 'bg-slate-900/50 backdrop-blur-sm',
  ariaLabel,
  ariaLabelledBy
}) => {

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalElement = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto ${backdropClassName}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className={`w-full my-auto transition-all animate-scale-up ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
};

