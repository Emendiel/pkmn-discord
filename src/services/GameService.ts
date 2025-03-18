import { Location, Player } from "../models/Utils";
import { PokemonService } from "./PokemonService";
import { Pokemon } from "../models/Pokemon";


export class GameService {
    private players: Record<string, Player> = {};
    private locations: Record<string, Location> = {};
    private pokemonService: PokemonService;

    constructor() {
        this.pokemonService = new PokemonService();
        this.locations = {
            "bourg-palette": {
              description: "Un village calme et paisible, le point de départ de nombreux dresseurs.",
              routes: ["route-1"],
              actions: ["parler au professeur Chen", "explorer la maison"],
              pokemons: []
            },
            "route-1": {
              description: "La première route pleine de Pokémon sauvages.",
              routes: ["bourg-palette", "jadielle"],
              actions: ["chercher des Pokémon sauvages", "ramasser des baies"],
              pokemons: [
                this.pokemonService.getPokemonByName("Rattata"), 
                this.pokemonService.getPokemonByName("Roucool"), 
                this.pokemonService.getPokemonByName("Chenipan")
              ].filter((pokemon): pokemon is Pokemon => pokemon !== null)
            },
            "jadielle": {
              description: "La ville de Jadielle, où se trouve la première arène Pokémon.",
              routes: ["route-1"],
              actions: ["aller au centre Pokémon", "visiter l'arène"],
              pokemons: []
            }
        };
    }

    public getLocation(locationId: string): Location {
        return this.locations[locationId];
    }

    public getLocations(): Record<string, Location> {
        return this.locations;
    }

    public getPlayer(playerId: string): Player {
        return this.players[playerId];
    }

    public getPlayers(): Record<string, Player> {
        return this.players;
    }

    public addPlayer(playerId: string, player: Player): void {
        this.players[playerId] = player;
    }

    public isPlayer(playerId: string): boolean {
        return this.players[playerId] !== undefined;
    }

    public getCurrentLocation(playerId: string): string {
        return this.players[playerId].location;
    }

    public isLocation(locationId: string): boolean {
        return this.locations[locationId] !== undefined;
    }

    public updatePlayerLocation(playerId: string, locationId: string): void {
        this.players[playerId].location = locationId;
    }

    public updatePlayerPokemons(playerId: string, pokemons: Pokemon[]): void {
        this.players[playerId].pokemons = pokemons;
    }

    public addPlayerPokemon(playerId: string, pokemon: Pokemon): void {
        this.players[playerId].pokemons.push(pokemon);
    }
    
    public removePlayer(playerId: string): void {
        delete this.players[playerId];
    }
    
}