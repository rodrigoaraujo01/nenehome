
import { MEMBERS } from "@/lib/constants";
import type { CosmeticPayload } from "@/lib/types";

interface AvatarProps {
  spriteUrl: string | null;
  nickname: string;
  size?: number;
  /** Moldura equipada (cosmético slot avatar_frame). */
  frame?: CosmeticPayload | null;
}

function frameBackground(frame: CosmeticPayload): string {
  return frame.ring === "gradient"
    ? `linear-gradient(135deg, ${frame.from ?? "#f59e0b"}, ${frame.to ?? "#ef4444"})`
    : frame.color ?? "#f59e0b";
}

export function Avatar({ spriteUrl, nickname, size = 128, frame }: AvatarProps) {
  const resolved = MEMBERS.find((m) => m.nickname === nickname)?.spriteUrl
    || spriteUrl
    || null;

  const inner = !resolved ? (
    <div
      className="rounded-full bg-beige-dark flex items-center justify-center font-display italic text-foreground/60"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {nickname.charAt(0)}
    </div>
  ) : (
    <img
      src={resolved}
      alt={`Avatar de ${nickname}`}
      width={size}
      height={size}
      className="rounded-full object-cover bg-surface-light"
      style={{ width: size, height: size }}
    />
  );

  if (!frame) return inner;

  const thickness = Math.max(2, Math.round(size * 0.05));
  return (
    <div
      className={frame.animate ? "animate-pulse" : undefined}
      style={{
        padding: thickness,
        background: frameBackground(frame),
        borderRadius: "9999px",
      }}
    >
      {inner}
    </div>
  );
}
