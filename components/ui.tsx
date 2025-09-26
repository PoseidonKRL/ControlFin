
import React, { ReactNode } from 'react';
import { Icon, availableIcons } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-md">
      <div className="bg-[var(--color-bg-glass)] border border-[var(--color-border)] rounded-xl shadow-2xl shadow-purple-500/10 w-full max-w-lg m-4 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
        <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)]">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale { animation: fade-in-scale 0.3s forwards cubic-bezier(0.25, 0.46, 0.45, 0.94); }
      `}</style>
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg';
  
  const variantClasses = {
    primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:scale-95 focus:ring-[var(--color-accent)] shadow-[var(--color-accent)]/20 hover:shadow-[var(--color-accent)]/30',
    secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[rgba(128,128,128,0.2)] active:scale-95 focus:ring-gray-500 border border-[var(--color-border)]',
    danger: 'bg-[var(--color-danger-strong)] text-white hover:opacity-90 active:scale-95 focus:ring-[var(--color-danger-strong)] shadow-red-500/20 hover:shadow-red-500/30',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({label, ...props }, ref) => (
    <div>
        {label && <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{label}</label>}
        <input
            ref={ref}
            className="w-full bg-transparent border-2 border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-0 focus:border-[var(--color-accent)] transition-all"
            {...props}
        />
    </div>
));
Input.displayName = 'Input';


interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({label, children, icon, className, ...props}) => (
    <div>
        {label && <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{label}</label>}
        <div className="relative group">
            {icon && (
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--color-text-secondary)] group-focus-within:text-[var(--color-accent)] transition-colors">
                    {icon}
                </div>
            )}
            <select
                 className={`w-full bg-transparent border border-[var(--color-border)] rounded-lg py-2.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] hover:border-[var(--color-accent)]/50 transition-all appearance-none ${icon ? 'pl-10' : 'pl-4'} pr-10 ${className}`}
                {...props}
            >
                {children}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                 <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-focus-within:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
            </div>
        </div>
    </div>
);


interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-[var(--color-bg-glass)] backdrop-blur-lg border border-[var(--color-border)] rounded-xl shadow-lg p-6 transition-all duration-300 hover:border-[var(--color-accent)]/50 ${className}`}>
      {children}
    </div>
  );
};


export const Spinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-text-primary)]"></div>
);

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  children,
  confirmText = 'Confirmar',
  confirmVariant = 'primary'
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-[var(--color-text-secondary)]">
        {children}
      </div>
      <div className="flex justify-end gap-3 pt-6">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconName: string) => void;
}

export const IconPickerModal: React.FC<IconPickerModalProps> = ({ isOpen, onClose, onSelectIcon }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Selecionar Ícone">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-4 max-h-[60vh] overflow-y-auto p-1">
                {availableIcons.map(iconName => (
                    <button
                        key={iconName}
                        onClick={() => {
                            onSelectIcon(iconName);
                            onClose();
                        }}
                        className="p-3 bg-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-accent)] hover:text-white transition-colors flex items-center justify-center aspect-square"
                        aria-label={`Select icon ${iconName.replace(/_/g, ' ')}`}
                    >
                        <Icon name={iconName} className="h-7 w-7 sm:h-8 sm:w-8" />
                    </button>
                ))}
            </div>
        </Modal>
    );
};
