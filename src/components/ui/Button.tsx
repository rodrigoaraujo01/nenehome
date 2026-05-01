interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "accent" | "ghost";
}

export function Button({
  variant = "accent",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base = "px-5 py-2.5 rounded-xl font-semibold transition-all cursor-pointer";
  const variants = {
    accent: "bg-accent text-background hover:bg-accent-hover",
    ghost: "bg-surface-light text-foreground hover:bg-border",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
