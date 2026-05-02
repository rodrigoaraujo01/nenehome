interface CurrencyBadgeProps {
  value: number;
  label: string;
  icon: "points" | "nenecoins" | "firecoins";
}

const colorMap = {
  points: "bg-yellow/10 border-yellow/30 text-yellow",
  nenecoins: "bg-green/10 border-green/30 text-green",
  firecoins: "bg-accent/10 border-accent/30 text-accent",
};

export function CurrencyBadge({ value, label, icon }: CurrencyBadgeProps) {
  const colors = colorMap[icon];
  return (
    <div className={`flex-1 border rounded-2xl px-4 py-3 ${colors}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
