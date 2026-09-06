export interface BattleQuestion {
  id: number;
  level: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const BATTLE_QUESTIONS: BattleQuestion[];
export function getRandomBattleQuestion(excludeIds?: number[]): BattleQuestion;
