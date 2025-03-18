import { Move, Pokemon } from "../models/Pokemon";

const pkmnList = require('../data/pokemon_data.json');
const typeChart = require('../data/type_chart.json');
const movesList = require('../data/moves.json');

export class PokemonService {

    // Fonction pour récupérer un Pokémon par son nom depuis pkmnList
    public getPokemonByName(name: string): Pokemon | null {
        const pkmn = Object.values(pkmnList).find(
            p => (p as Pokemon).name.toLowerCase() === name.toLowerCase()
        ) as Pokemon | undefined;

        if (!pkmn) return null;
        return pkmn;
    }

    public getStarters(): Pokemon[] {
        return [
            this.getPokemonByName("Bulbizarre"),
            this.getPokemonByName("Salamèche"),
            this.getPokemonByName("Carapuce")
        ].filter((pokemon): pokemon is Pokemon => pokemon !== null);
    }

    public getPokemonList(): Pokemon[] {
        return Object.values(pkmnList).filter((pokemon): pokemon is Pokemon => pokemon !== null);
    }

    public getMovesList(): Move[] {
        return Object.values(movesList).filter((move): move is Move => move !== null);
    }

    public getMoveByID(moveId: string): Move | null {
        return this.getMovesList().find((move): move is Move => move.id.toLowerCase() === moveId.toLowerCase()) || null;
    }

    public getTypeChart(): Record<string, Record<string, number>> {
        return typeChart;
    }

    public getPokemonByID(pokemonId: number): Pokemon | null {
        return this.getPokemonList().find((pokemon): pokemon is Pokemon => pokemon.id === pokemonId) || null;
    }

}
