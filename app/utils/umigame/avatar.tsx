import type { CSSProperties } from "react";
import {
  Atom, Bird, BookOpen, Bot, Box, Brain, Camera, Cat, Cherry, CircleDot,
  Clover, Cloud, Code, Coffee, Compass, Cpu, Crown, Dog, Fish, Flame,
  Gamepad2, Gem, Ghost, Heart, KeyRound, Leaf, Lightbulb, Moon, Music,
  Orbit, Palette, PawPrint, Puzzle, Rabbit, Rocket, Shield, Smile,
  Sparkles, Star, Sun, Sword, Telescope, Terminal, User, Zap,
  type LucideIcon,
} from "lucide-react";

export type UmigameAvatarType = "lucide" | "oauth" | "generated";

export const AVATAR_ICONS = [
  "user", "ghost", "cat", "dog", "bird", "fish", "rabbit", "crown",
  "puzzle", "brain", "bot", "rocket", "moon", "sun", "star", "zap",
  "flame", "coffee", "code", "terminal", "gamepad2", "shield", "sword",
  "telescope", "atom", "gem", "sparkles", "leaf", "cloud", "heart",
  "smile", "music", "camera", "palette", "book-open", "lightbulb",
  "key-round", "compass", "orbit", "cpu", "box", "circle-dot", "cherry",
  "clover", "paw-print",
] as const;

export type UmigameAvatarIcon = typeof AVATAR_ICONS[number];
export const AVATAR_COLORS = [
  "slate", "gray", "red", "orange", "amber", "green",
  "emerald", "cyan", "blue", "indigo", "violet", "pink",
] as const;

export type UmigameAvatarColor = typeof AVATAR_COLORS[number];

const ICONS: Record<UmigameAvatarIcon, LucideIcon> = {
  user: User, ghost: Ghost, cat: Cat, dog: Dog, bird: Bird, fish: Fish,
  rabbit: Rabbit, crown: Crown, puzzle: Puzzle, brain: Brain, bot: Bot,
  rocket: Rocket, moon: Moon, sun: Sun, star: Star, zap: Zap, flame: Flame,
  coffee: Coffee, code: Code, terminal: Terminal, gamepad2: Gamepad2,
  shield: Shield, sword: Sword, telescope: Telescope, atom: Atom, gem: Gem,
  sparkles: Sparkles, leaf: Leaf, cloud: Cloud, heart: Heart, smile: Smile,
  music: Music, camera: Camera, palette: Palette, "book-open": BookOpen,
  lightbulb: Lightbulb, "key-round": KeyRound, compass: Compass, orbit: Orbit,
  cpu: Cpu, box: Box, "circle-dot": CircleDot, cherry: Cherry, clover: Clover,
  "paw-print": PawPrint,
};

const COLOR_VALUES: Record<UmigameAvatarColor, string> = {
  slate: "#64748b", gray: "#6b7280", red: "#ef4444", orange: "#f97316",
  amber: "#f59e0b", green: "#22c55e", emerald: "#10b981", cyan: "#06b6d4",
  blue: "#3b82f6", indigo: "#6366f1", violet: "#8b5cf6", pink: "#ec4899",
};
export function normalizeAvatarIcon(value: unknown): UmigameAvatarIcon {
  return typeof value === "string" && (AVATAR_ICONS as readonly string[]).includes(value)
    ? value as UmigameAvatarIcon
    : "user";
}

export function normalizeAvatarColor(value: unknown): UmigameAvatarColor {
  return typeof value === "string" && (AVATAR_COLORS as readonly string[]).includes(value)
    ? value as UmigameAvatarColor
    : "slate";
}

function hashIndex(value: string, length: number) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % length;
}

export function generatedAvatar(userId: string) {
  return {
    icon: AVATAR_ICONS[hashIndex(userId, AVATAR_ICONS.length)],
    color: AVATAR_COLORS[hashIndex(userId + ":color", AVATAR_COLORS.length)],
  };
}
export function UmigameAvatar({
  userId,
  type,
  icon,
  color,
  externalUrl,
  size = 36,
}: {
  userId: string;
  type: UmigameAvatarType;
  icon?: string | null;
  color?: string | null;
  externalUrl?: string | null;
  size?: number;
}) {
  if (type === "oauth" && externalUrl) {
    return (
      <img
        className="umigame-avatar"
        src={externalUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
      />
    );
  }

  const generated = generatedAvatar(userId);
  const iconName = type === "generated" ? generated.icon : normalizeAvatarIcon(icon);
  const colorName = type === "generated" ? generated.color : normalizeAvatarColor(color);
  const Icon = ICONS[iconName];
  const style = {
    "--avatar-color": COLOR_VALUES[colorName],
    width: size,
    height: size,
  } as CSSProperties;

  return (
    <span className="umigame-avatar umigame-avatar--icon" style={style} aria-hidden="true">
      <Icon size={Math.round(size * 0.52)} strokeWidth={1.8} />
    </span>
  );
}
