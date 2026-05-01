interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-2xl border border-border p-5 ${className}`}
    >
      {children}
    </div>
  );
}
