"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const HIDDEN_ON = ["/login", "/primeiro-acesso"];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function QuestionsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function PhotosIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="15" rx="2" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 5l1.5-3h5L16 5" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const profileHref = profile
    ? `/perfil/${profile.nickname.toLowerCase()}`
    : "/login";

  const links = [
    { href: "/", label: "Início", icon: HomeIcon, active: pathname === "/" },
    {
      href: "/perguntas",
      label: "Perguntas",
      icon: QuestionsIcon,
      active: pathname.startsWith("/perguntas"),
    },
    {
      href: "/fotos",
      label: "Fotos",
      icon: PhotosIcon,
      active: pathname.startsWith("/fotos"),
    },
    {
      href: profileHref,
      label: "Perfil",
      icon: ProfileIcon,
      active: pathname.startsWith("/perfil"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
      <div className="max-w-lg mx-auto flex">
        {links.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              active ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon active={active} />
            <span className="text-[10px] font-semibold tracking-wide">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
