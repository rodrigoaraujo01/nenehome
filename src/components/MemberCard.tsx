
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { Card } from "./ui/Card";
import { useCosmetics, nameStyleCss } from "@/hooks/useCosmetics";
import type { Member } from "@/lib/types";

interface MemberCardProps {
  member: Member;
  index: number;
}

export function MemberCard({ member, index }: MemberCardProps) {
  const { frameFor, nameStyleFor } = useCosmetics();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Link to={`/perfil/${member.nickname.toLowerCase()}`}>
        <Card className="flex flex-col items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
          <Avatar
            spriteUrl={member.spriteUrl}
            nickname={member.nickname}
            size={96}
            frame={frameFor(member.nickname)}
          />
          <p
            className="font-body font-semibold text-foreground"
            style={nameStyleCss(nameStyleFor(member.nickname))}
          >
            {member.nickname}
          </p>
        </Card>
      </Link>
    </motion.div>
  );
}
