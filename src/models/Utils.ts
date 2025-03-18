import { Pokemon } from "./Pokemon";

interface Player {
  location: string;
  pokemons: Pokemon[];
}
  
interface Location {
  description: string;
  routes: string[];
  actions: string[];
  pokemons: Pokemon[];
}

export { Player, Location };