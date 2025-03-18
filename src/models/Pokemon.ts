interface Effect {
    type: string;
    chance: number;
  }

interface Move {
    id: string;
    name: string;
    power: number;
    accuracy: number;
    pp: number;
    currentPP?: number;
    type: string;
    category: 'Physique' | 'Spécial' | 'Statut';
    effect?: Effect;
    effectChance?: number;
}

interface MovesListType {
  [key: string]: Move;
}

interface Stats {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
}

interface Pokemon {
    id: number;
    name: string;
    types: string[];
    baseStats: Stats;
    learnset: Record<string, string[]>;
    level?: number;
    exp?: number;
    maxExp?: number;
    stats?: Stats;
    currentHp?: number;
    moves?: Move[];
  }

  export { Pokemon, Stats, Move, MovesListType };