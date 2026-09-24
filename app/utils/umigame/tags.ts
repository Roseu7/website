export const UMIGAME_TAGS = [
  {
    id: "short",
    name: "短め",
    description: "比較的少ない質問で遊び終えやすい問題",
    authorSelectable: true,
  },
  {
    id: "deep",
    name: "じっくり",
    description: "仮説を重ねながら時間をかけて遊ぶ問題",
    authorSelectable: true,
  },
  {
    id: "beginner",
    name: "はじめて向け",
    description: "ウミガメのスープに慣れていない人にも進めやすい問題",
    authorSelectable: true,
  },
  {
    id: "good",
    name: "良問",
    description:
      "矛盾や後付け感が少なく、真相が問題文を十分に説明し、公平に推理できる問題",
    authorSelectable: false,
  },
] as const;

export const UMIGAME_AUTHOR_TAGS = UMIGAME_TAGS.filter(
  (tag) => tag.authorSelectable !== false,
);

export type UmigameTagId = (typeof UMIGAME_TAGS)[number]["id"];

const TAG_IDS = new Set<string>(UMIGAME_TAGS.map((tag) => tag.id));
const AUTHOR_TAG_IDS = new Set<string>(UMIGAME_AUTHOR_TAGS.map((tag) => tag.id));

export function isUmigameTagId(value: string): value is UmigameTagId {
  return TAG_IDS.has(value);
}

export function isAuthorSelectableUmigameTagId(
  value: string,
): value is UmigameTagId {
  return AUTHOR_TAG_IDS.has(value);
}
