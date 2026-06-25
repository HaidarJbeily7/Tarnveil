import type { SkillId } from "./entities.js";

export type QuestTrigger =
  | { kind: "gather"; resource: string }
  | { kind: "kill"; mobKind: string };

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  trigger: QuestTrigger;
  target: number;
  rewardGold: number;
  rewardXp: number;
  rewardSkill: SkillId;
}

export const DAILY_QUEST_RESET_MS = 24 * 60 * 60 * 1000;

export const DAILY_QUESTS: readonly QuestDef[] = [
  {
    id: "daily-wood-3",
    name: "Stock the woodpile",
    description: "Chop 3 logs of wood.",
    trigger: { kind: "gather", resource: "wood" },
    target: 3,
    rewardGold: 30,
    rewardXp: 25,
    rewardSkill: "woodcutting",
  },
  {
    id: "daily-stone-2",
    name: "Quarry visit",
    description: "Mine 2 stones.",
    trigger: { kind: "gather", resource: "stone" },
    target: 2,
    rewardGold: 25,
    rewardXp: 25,
    rewardSkill: "mining",
  },
  {
    id: "daily-wolf-1",
    name: "Cull the pack",
    description: "Defeat a wolf.",
    trigger: { kind: "kill", mobKind: "wolf" },
    target: 1,
    rewardGold: 50,
    rewardXp: 50,
    rewardSkill: "combat",
  },
];

export function findQuestsForGather(resource: string): readonly QuestDef[] {
  return DAILY_QUESTS.filter(
    (q) => q.trigger.kind === "gather" && q.trigger.resource === resource,
  );
}

export function findQuestsForKill(mobKind: string): readonly QuestDef[] {
  return DAILY_QUESTS.filter(
    (q) => q.trigger.kind === "kill" && q.trigger.mobKind === mobKind,
  );
}
