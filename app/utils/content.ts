export interface ProjectItem {
  id: string;
  alt: string;
  imagePng: string;
  imageWebp: string;
  title: string;
  description: string[];
  repoUrl: string;
  repoVisibility: "public" | "private";
  stack: Array<{ label: string; tone: string }>;
}

export const projects: ProjectItem[] = [
  {
    id: "valocs",
    alt: "ばろくす project preview",
    imagePng: "/images/valocs.png",
    imageWebp: "/images/valocs.webp",
    title: "ばろくす",
    description: [
      "VALOrant Custom Support bot",
      "ばろくすは、VALORANTのカスタムマッチのためのプレイヤー募集を支援するDiscordボットです。",
      "技育ハッカソン2024 Vol.8にて制作しました。",
    ],
    repoUrl: "https://github.com/Roseu7/valocs",
    repoVisibility: "public",
    stack: [
      { label: "Python", tone: "violet" },
      { label: "Discord.py", tone: "indigo" },
      { label: "Supabase", tone: "green" },
    ],
  },
  {
    id: "botomeru",
    alt: "ぼとめる project preview",
    imagePng: "/images/botomeru.png",
    imageWebp: "/images/botomeru.webp",
    title: "ぼとめる",
    description: [
      "日々のふとしたことを誰かに届ける/誰かから受け取るサービスです。ボトルメールのように過去の手紙が流れ着くかもしれません。",
      "技育ハッカソン2024 Vol.7にて制作しました。",
      "※未完成",
    ],
    repoUrl: "https://github.com/Roseu7/geek0623",
    repoVisibility: "public",
    stack: [
      { label: "TypeScript", tone: "blue" },
      { label: "TailwindCSS", tone: "cyan" },
      { label: "Next.js", tone: "slate" },
      { label: "Supabase", tone: "green" },
      { label: "Vercel", tone: "mono" },
    ],
  },
  {
    id: "digitalsandbox",
    alt: "Digital Sandbox project preview",
    imagePng: "/images/digitalsandbox.png",
    imageWebp: "/images/digitalsandbox.webp",
    title: "Digital Sandbox",
    description: [
      "私がやりたい/作ってみたい機能を実際に作成して、記録に残すサイトです。",
    ],
    repoUrl: "https://github.com/Roseu7/website",
    repoVisibility: "public",
    stack: [
      { label: "TypeScript", tone: "blue" },
      { label: "TailwindCSS", tone: "cyan" },
      { label: "DaisyUI", tone: "mono" },
      { label: "React Router", tone: "sky" },
      { label: "Cloudflare Workers", tone: "orange" },
    ],
  },
];

export const aboutContent = {
  name: "ろせ / Roseu",
  intro:
    "2008年頃からパソコンに触れ始め、2013年頃からMinecraftを通してプログラミングに興味を持つ。それ以降、気ままに興味を持った言語でプログラムを作っています。",
  skills: "広く浅く、様々な技術に触れるのが好きです。",
  skillList: "Python, TypeScript, Java, C, etc.",
  profileAlt: "Roseu's profile picture",
  profilePng: "/images/profile.png",
  profileWebp: "/images/profile.webp",
} as const;
