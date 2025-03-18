// Constantes
const POKEMON_SPRITE_URL: string = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const HP_BAR_LENGTH: number = 10; // Longueur de la barre de vie en caractères

// Émojis de type
const TYPE_EMOJIS: Record<string, string> = {
  "Normal": "⚪",
  "Feu": "🔥",
  "Eau": "💧",
  "Plante": "🌱",
  "Électrique": "⚡",
  "Glace": "❄️",
  "Combat": "👊",
  "Poison": "☠️",
  "Sol": "🌍",
  "Vol": "🦅",
  "Psy": "🔮",
  "Insecte": "🐛",
  "Roche": "🪨",
  "Spectre": "👻",
  "Dragon": "🐉",
  "Acier": "⚔️",
  "Fée": "🎀"
};

// Préfixe des commandes
const PREFIX: string = "pkmn";

export { POKEMON_SPRITE_URL, HP_BAR_LENGTH, TYPE_EMOJIS, PREFIX };
