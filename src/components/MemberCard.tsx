"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { Card } from "./ui/Card";
import type { Member } from "@/lib/types";

interface MemberCardProps {
  member: Member;
  index: number;
}

export function MemberCard({ member, index }: MemberCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Link href={`/perfil/${member.nickname.toLowerCase()}`}>
        <Card className="flex flex-col items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
          <Avatar spriteUrl={member.spriteUrl} nickname={member.nickname} size={96} />
          <p className="font-body font-semibold text-foreground">{member.nickname}</p>
        </Card>
      </Link>
    </motion.div>
  );
}
