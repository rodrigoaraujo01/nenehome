export interface Member {
  id: string;
  name: string;
  nickname: string;
  email: string | null;
  spriteUrl: string | null;
  coupleGroup: number;
  role: "adult" | "child";
}

export interface Couple {
  id: number;
  label: string;
  members: Member[];
}
