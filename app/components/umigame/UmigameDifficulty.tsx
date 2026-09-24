import { Star } from "lucide-react";

const DIFFICULTY_LEVELS: Record<string, number> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5,
};

interface UmigameDifficultyProps {
  value: string;
  className?: string;
}

export function UmigameDifficulty({
  value,
  className,
}: UmigameDifficultyProps) {
  const level = DIFFICULTY_LEVELS[value] ?? null;
  const classes = ["umigame-difficulty", className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      data-difficulty={value}
      aria-label={level ? `難易度 ${level} / 5` : `難易度 ${value}`}
    >
      <Star size={13} aria-hidden="true" />
      <span className="umigame-icon-pair__value">{level ?? value}</span>
    </span>
  );
}
