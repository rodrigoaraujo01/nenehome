
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
  if (frame.ring !== "gradient") return frame.color ?? "#f59e0b";
  // Multi-cor (ex. arco-íris) via array; senão from/to.
  const base =
    frame.gradient && frame.gradient.length > 0
      ? frame.gradient
      : [frame.from ?? "#f59e0b", frame.to ?? "#ef4444"];
  // Quando anima, repete a 1ª cor no fim pra o slide fazer loop sem emenda.
  const stops = frame.animate ? [...base, base[0]] : base;
  const angle = frame.animate ? 90 : 135;
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

export function Avatar({ spriteUrl, nickname, size = 128, frame }: AvatarProps) {
  const resolved = MEMBERS.find((m) => m.nickname === nickname)?.spriteUrl
    || spriteUrl
    || null;

  // O footprint total é SEMPRE `size` (com ou sem moldura) pra todos ficarem
  // alinhados. A moldura ocupa a borda; a imagem interna encolhe pra caber.
  const ratio = frame?.animate ? 0.07 : 0.05;
  const thickness = frame
    ? Math.max(frame.animate ? 3 : 2, Math.round(size * ratio))
    : 0;
  const innerSize = size - thickness * 2;

  const inner = !resolved ? (
    <div
      className="rounded-full bg-beige-dark flex items-center justify-center font-display italic text-foreground/60"
      style={{ width: innerSize, height: innerSize, fontSize: innerSize * 0.4 }}
    >
      {nickname.charAt(0)}
    </div>
  ) : (
    <img
      src={resolved}
      alt={`Avatar de ${nickname}`}
      width={innerSize}
      height={innerSize}
      className="rounded-full object-cover bg-surface-light"
      style={{ width: innerSize, height: innerSize }}
    />
  );

  if (!frame) return inner;

  const bgStyle = frame.ring === "gradient"
    ? { backgroundImage: frameBackground(frame) }
    : { backgroundColor: frameBackground(frame) };

  // Lendária: dodecágono girando atrás de um avatar circular estático.
  if (frame.animate) {
    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <div
          className="cosmetic-frame-octagon"
          style={{ position: "absolute", inset: 0, ...bgStyle }}
        />
        <div style={{ position: "absolute", inset: thickness }}>{inner}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...bgStyle,
        borderRadius: "9999px",
      }}
    >
      {inner}
    </div>
  );
}
