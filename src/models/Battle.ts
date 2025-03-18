import { Pokemon, Stats } from "./Pokemon";

interface BattleState {
  wildPokemon: Pokemon;
  playerPokemon: Pokemon;
  wildStatus?: {
    type: string;
    turns?: number;
  };
  playerStatus?: {
    type: string;
    turns?: number;
  };
  initialPlayerStats?: Stats;  // Statistiques du Pokémon du joueur au début du combat
  initialWildStats?: Stats;    // Statistiques du Pokémon sauvage au début du combat
}

export { BattleState };