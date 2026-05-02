"use client";

import Image from "next/image";
import { MEMBERS } from "@/lib/constants";

interface AvatarProps {
  spriteUrl: string | null;
  nickname: string;
  size?: number;
}

export function Avatar({ spriteUrl, nickname, size = 128 }: AvatarProps) {
  const resolved = MEMBERS.find((m) => m.nickname === nickname)?.spriteUrl
    || spriteUrl
    || null;

  if (!resolved) {
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
      src={resolved}
      alt={`Avatar de ${nickname}`}
      width={size}
      height={size}
      className="rounded-full object-cover bg-surface-light"
      style={{ width: size, height: size }}
    />
  );
}
