import { CanvasRenderingContext2D, Image } from 'canvas';

export interface PokemonStats {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
}

export interface MoveEffect {
    type: string;
    chance: number;
}

export interface Move {
    name: string;
    type: string;
    category: string;
    power: number;
    accuracy: number;
    pp: number;
    currentPP: number;
    effect: MoveEffect | null;
}

export interface BattleState {
    playerPokemon: Pokemon;
    wildPokemon: Pokemon;
}

export interface Player {
    pokemons: Pokemon[];
    currentLocation: string;
}

export interface Location {
    description: string;
    routes: string[];
    actions: string[];
    pokemons: Pokemon[];
}

export interface TypeEffectiveness {
    [key: string]: number;
}

export interface TypeChart {
    [key: string]: {
        [key: string]: number;
    };
}

export interface MovesList {
    [key: string]: Move;
}

export interface Pokemon {
    name: string;
    types: string[];
    evolves: string | null;
    baseStats: PokemonStats;
    catchRate: number;
    expYield: number;
    growthRate: string;
    learnset: Record<number, string[]>;
    level: number;
    stats: PokemonStats;
    currentHp: number;
    moves: Move[];
}

export type PokemonDataList = Record<string, Pokemon>;

export interface Attacker {
    isPlayer: boolean;
    pokemon: Pokemon;
    opponent: Pokemon;
    move: Move;
}

export interface BattleEmbed {
    color: number;
    title: string;
    description: string;
    fields: {
        name: string;
        value: string;
        inline: boolean;
    }[];
    image?: {
        url: string;
    };
}

export interface ButtonInteraction {
    user: { id: string };
    customId: string;
    reply: (options: any) => Promise<void>;
    message: {
        components: any[];
    };
}

export type NodeCanvasImage = Image;
export type NodeCanvasContext2D = CanvasRenderingContext2D; 