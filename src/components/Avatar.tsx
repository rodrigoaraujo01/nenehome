"use client";

import Image from "next/image";

interface AvatarProps {
  spriteUrl: string | null;
  nickname: string;
  size?: number;
}

export function Avatar({ spriteUrl, nickname, size = 128 }: AvatarProps) {
  if (!spriteUrl) {
    return (
      <div
        className="rounded-full bg-beige-dark flex items-center justify-center font-display italic text-foreground/60"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {nickname.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={spriteUrl}
      alt={`Avatar de ${nickname}`}
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: "auto", imageRendering: "pixelated" }}
    />
  );
}
