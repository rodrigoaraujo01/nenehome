import { Member, Couple } from "./types";

export const MEMBERS: Member[] = [
  { id: "dani", name: "Danielle", nickname: "Dani", email: "dani_costa_@HOTMAIL.com", spriteUrl: "/sprites/dani-avatar.png", coupleGroup: 1, role: "adult" },
  { id: "leo", name: "Leonardo", nickname: "Leo", email: "lguanabara@gmail.com", spriteUrl: "/sprites/leo-avatar.png", coupleGroup: 1, role: "adult" },
  { id: "joca", name: "Joaquim", nickname: "Joca", email: null, spriteUrl: "/sprites/joaquim-avatar.png", coupleGroup: 1, role: "child" },
  { id: "malu", name: "Maria Luíza", nickname: "Malu", email: "castilhosmarialuisa@gmail.com", spriteUrl: "/sprites/malu-avatar.png", coupleGroup: 2, role: "adult" },
  { id: "grizante", name: "Ricardo Grizante", nickname: "Grizante", email: "ricardo.grizante@gmail.com", spriteUrl: "/sprites/grizante-avatar.png", coupleGroup: 2, role: "adult" },
  { id: "antonio", name: "Antônio", nickname: "Antônio", email: null, spriteUrl: null, coupleGroup: 2, role: "child" },
  { id: "maiana", name: "Maiana", nickname: "Maiana", email: "maiana.ds@gmail.com", spriteUrl: "/sprites/maiana-avatar.png", coupleGroup: 3, role: "adult" },
  { id: "rodrigo", name: "Rodrigo", nickname: "Rodrigo", email: "alf.rodrigo@gmail.com", spriteUrl: "/sprites/rodrigo-avatar.png", coupleGroup: 3, role: "adult" },
  { id: "sarah", name: "Sarah", nickname: "Sarah", email: null, spriteUrl: "/sprites/sarah-avatar.png", coupleGroup: 3, role: "child" },
  { id: "milena", name: "Milena", nickname: "Milena", email: "milenarempto@gmail.com", spriteUrl: "/sprites/milena-avatar.png", coupleGroup: 4, role: "adult" },
  { id: "thiago", name: "Thiago", nickname: "Thiago", email: "tcampanate@gmail.com", spriteUrl: "/sprites/thiago-avatar.png", coupleGroup: 4, role: "adult" },
  { id: "cecilia", name: "Cecília", nickname: "Cecília", email: null, spriteUrl: null, coupleGroup: 4, role: "child" },
];

export const COUPLES: Couple[] = [
  { id: 1, label: "Dani & Leo", members: MEMBERS.filter((m) => m.coupleGroup === 1) },
  { id: 2, label: "Malu & Grizante", members: MEMBERS.filter((m) => m.coupleGroup === 2) },
  { id: 3, label: "Maiana & Rodrigo", members: MEMBERS.filter((m) => m.coupleGroup === 3) },
  { id: 4, label: "Milena & Thiago", members: MEMBERS.filter((m) => m.coupleGroup === 4) },
];

export const ADULTS = MEMBERS.filter((m) => m.role === "adult");
