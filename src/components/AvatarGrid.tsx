"use client";

import { MemberCard } from "./MemberCard";
import type { Member } from "@/lib/types";

interface AvatarGridProps {
  members: Member[];
}

export function AvatarGrid({ members }: AvatarGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {members.map((member, i) => (
        <MemberCard key={member.id} member={member} index={i} />
      ))}
    </div>
  );
}
