interface CurrencyBadgeProps {
  value: number;
  label: string;
  icon: "points" | "nenecoins" | "firecoins";
}

const iconMap = {
  points: "⭐",
  nenecoins: "🪙",
  firecoins: "🔥",
};

export function CurrencyBadge({ value, label, icon }: CurrencyBadgeProps) {
  return (
    <div className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
      <span className="text-xl">{iconMap[icon]}</span>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-[10px] text-muted">{label}</p>
      </div>
    </div>
  );
}
