interface MenuButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function MenuButton({ label, onClick, variant = 'primary', disabled = false }: MenuButtonProps) {
  const baseClasses = 'px-8 py-3 rounded-lg font-bold text-lg uppercase tracking-wider transition-all duration-200 min-w-[200px]';
  const variants = {
    primary: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 hover:shadow-red-500/40 active:scale-95',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 active:scale-95',
  };
  const disabledClasses = 'opacity-50 cursor-not-allowed hover:bg-inherit active:scale-100';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${disabled ? disabledClasses : ''}`}
    >
      {label}
    </button>
  );
}
