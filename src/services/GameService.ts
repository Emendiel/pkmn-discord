import { Location, Player } from "../models/Utils";
import { PokemonService } from "./PokemonService";
import { Move, Pokemon, Stats } from "../models/Pokemon";
import * as path from 'path';
import * as fs from 'fs';
import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from "discord.js";
import { PREFIX, TYPE_EMOJIS } from "../utils/Utils";
import { BattleService } from "./BattleService";
export class GameService {
    public players: Record<string, Player> = {};
    private locations: Record<string, Location> = {};
    private pokemonService: PokemonService;
    private starters: Pokemon[] = [];
    private battleService: BattleService;

    constructor() {
        this.battleService = new BattleService();
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

    // Fonction pour charger les données du jeu
    public loadGameData(): void {
        try {
        const savePath = path.join(__dirname, 'data', 'game_save.json');
        
        // Vérifier si le fichier de sauvegarde existe
        if (fs.existsSync(savePath)) {
            const saveData = JSON.parse(fs.readFileSync(savePath, 'utf8'));
            
            // Restaurer les données des joueurs
            if (saveData.players) {
            Object.assign(this.players, saveData.players);
            console.log('Données des joueurs chargées avec succès');
            }
            
            // Les états de bataille ne sont pas restaurés car ils nécessitent des objets Canvas
            // et contiennent des références circulaires
        }
        } catch (error) {
        console.error('Erreur lors du chargement des données du jeu:', error);
        }
    }

    // Fonction pour sauvegarder les données du jeu
    public saveGameData(): void {
        // Créer l'objet de données à sauvegarder
        const gameData = {
        players: this.players,
        // Ne pas sauvegarder les états de bataille car ils contiennent des références circulaires
        // et nécessitent des objets Canvas qui ne peuvent pas être sérialisés
        };
    
        try {
        // Assurer que le dossier data existe
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    
        // Sauvegarder les données dans un fichier JSON
        const savePath = path.join(dataDir, 'game_save.json');
        fs.writeFileSync(savePath, JSON.stringify(gameData, null, 2), 'utf8');
        console.log(`Données de jeu sauvegardées dans ${savePath}`);
        } catch (error) {
        console.error('Erreur lors de la sauvegarde des données du jeu:', error);
        }
    }

    // Fonction pour gérer la commande /start
    public handleStartCommand(message: Message): void {
        if (this.isPlayer(message.author.id)) {
        message.reply(`Tu as déjà commencé ton aventure, ${message.author.username} ! Utilise ${PREFIX} explore pour explorer les environs.`);
        } else {
            this.addPlayer(message.author.id, {} as Player);
            this.starters = this.pokemonService.getStarters();

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                new ButtonBuilder()
                    .setCustomId(this.starters[0].name.toLowerCase())
                    .setLabel(this.starters[0].name)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(this.starters[1].name.toLowerCase())
                    .setLabel(this.starters[1].name)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(this.starters[2].name.toLowerCase())
                    .setLabel(this.starters[2].name)
                    .setStyle(ButtonStyle.Primary)
                );
        
            message.reply({ content: `Bienvenue dans le monde de Pokémon, ${message.author.username} ! Choisis ton starter :`, components: [row] });
        }
    }

    // Fonction pour gérer la commande /explore
    public handleExploreCommand(interaction: Message | ButtonInteraction): void {
        const userId = interaction instanceof Message ? interaction.author.id : interaction.user.id;
        
        if (!this.isPlayer(userId)) {
            const reply = { content: "Utilise d'abord pkmn start pour commencer ton aventure !", ephemeral: true };
            
            if (interaction instanceof Message) {
                interaction.reply(reply);
            } else {
                interaction.reply(reply);
            }
            return;
        }
    
        const currentLocation = this.getCurrentLocation(userId);
        if (!this.isLocation(currentLocation)) {
            const reply = { content: "La localisation actuelle est invalide. Veuillez redémarrer l'aventure.", ephemeral: true };
            
            if (interaction instanceof Message) {
                interaction.reply(reply);
            } else {
                interaction.reply(reply);
            }
            return;
        }
        
        const availableRoutes = this.getLocation(currentLocation).routes;
        const availableActions = this.getLocation(currentLocation).actions;
    
        const row = new ActionRowBuilder<ButtonBuilder>();
        availableRoutes.forEach((route: string) => {
            row.addComponents(
                new ButtonBuilder()
                .setCustomId(route)
                .setLabel(route.charAt(0).toUpperCase() + route.slice(1))
                .setStyle(ButtonStyle.Primary)
            );
        });
        
        availableActions.forEach((action: string) => {
            row.addComponents(
                new ButtonBuilder()
                .setCustomId(`action_${action.replace(/\s+/g, '_').toLowerCase()}`)
                .setLabel(action)
                .setStyle(ButtonStyle.Secondary)
            );
        });
    
        const reply = { 
            content: `Où veux-tu aller depuis **${currentLocation}** ou quelle action veux-tu entreprendre ?`, 
            components: [row] 
        };
        
        if (interaction instanceof Message) {
            interaction.reply(reply);
        } else {
            interaction.reply(reply);
        }
    }

    // Fonction pour gérer la commande /status
    public handleStatusCommand(message: Message): void {
        if (!this.isPlayer(message.author.id)) {
            message.reply("Utilise d'abord pkmn start pour commencer ton aventure !");
        } else {
            const location = this.getPlayer(message.author.id).location;
            const pokemons = this.getPlayer(message.author.id).pokemons.map(pokemon => pokemon.name);
            message.reply(`Tu es actuellement à **${location}**. Tes Pokémon : ${pokemons.join(', ')}. Utilise ${PREFIX} explore pour continuer ton exploration.`);
        }
    }

    // Fonction pour gérer la sélection de starter
    public handleStarterSelection(interaction: ButtonInteraction): void {
        const userId = interaction.user.id;
        let chosenStarter = this.starters.find(starter => starter.name.toLowerCase() === interaction.customId.toLowerCase());

        if (chosenStarter) {
            const level = 5;
            const stats = this.calculateStats(chosenStarter, level);

            // Récupération des attaques de départ depuis le learnset
            const starterMoves = Object.entries(chosenStarter.learnset)
                .filter(([reqLevel]) => parseInt(reqLevel) <= level)
                .flatMap(([, moves]) => moves)
                .slice(0, 4); // Maximum 4 attaques

            const moves = starterMoves.map(moveId => ({
                ...this.pokemonService.getMoveByID(moveId),
                currentPP: this.pokemonService.getMoveByID(moveId)?.pp
            })) as Move[];

            const starterPokemon: Pokemon = {
                ...chosenStarter,
                level: level,
                exp: 0,
                maxExp: 100,
                stats: stats,
                currentHp: stats.hp,
                moves: moves
            };

            this.updatePlayerLocation(userId, 'bourg-palette');
            this.addPlayerPokemon(userId, starterPokemon);

            interaction.reply({
                content:
                    `${interaction.user.username}, tu as choisi **${starterPokemon.name}** niveau ${level} comme starter !\n` +
                    `Stats: PV ${stats.hp}, Attaque ${stats.attack}, Défense ${stats.defense}, ` +
                    `Attaque Spé ${stats.spAttack}, Défense Spé ${stats.spDefense}, Vitesse ${stats.speed}\n` +
                    `Attaques: ${starterPokemon.moves?.map(move => move.name).join(", ") || "Aucune attaque"}`,
                components: [this.createExploreButton()]
            });
        }
    }

    // Fonction pour créer le bouton Explorer
    public createExploreButton(): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('explore_location')
                    .setLabel('Explorer')
                    .setStyle(ButtonStyle.Success)
            );
    }

    // Fonction pour calculer les statistiques d'un Pokémon
    public calculateStats(pokemon: Pokemon, level: number): Stats {
        const stats: Stats = {
            hp: 0,
            attack: 0,
            defense: 0,
            spAttack: 0,
            spDefense: 0,
            speed: 0
        };

        // Calcul des PV
        stats.hp = Math.floor(((2 * pokemon.baseStats.hp + 31 + Math.floor(252 / 4)) * level) / 100 + level + 10);

        // Calcul des autres stats
        const otherStats: (keyof Stats)[] = ['attack', 'defense', 'spAttack', 'spDefense', 'speed'];
        otherStats.forEach(stat => {
            stats[stat] = Math.floor(((2 * pokemon.baseStats[stat] + 31 + Math.floor(252 / 4)) * level) / 100 + 5);
        });

        return stats;
    }

    // Fonction pour gérer la recherche de Pokémon sauvages
    public handleWildPokemonSearch(interaction: ButtonInteraction, currentLocation: string): void {
        const wildPokemons = this.getLocation(currentLocation).pokemons;
        if (wildPokemons.length === 0) {
            interaction.reply({ content: "Il n'y a pas de Pokémon sauvages ici.", ephemeral: true });
            return;
        }

        const foundPokemon = wildPokemons[Math.floor(Math.random() * wildPokemons.length)];
        const wildPokemonLevel = 5;
        const wildPokemonStats = this.calculateStats(foundPokemon, wildPokemonLevel);

        // Récupération des attaques disponibles pour le niveau du Pokémon
        const availableMoves: Move[] = [];
        Object.entries(foundPokemon.learnset).forEach(([level, moves]) => {
            if (parseInt(level) <= wildPokemonLevel) {
                moves.forEach(moveId => {
                    const move = this.pokemonService.getMoveByID(moveId);
                    if (move) {
                        availableMoves.push({
                            ...move,
                            currentPP: move.pp
                        });
                    }
                });
            }
        });

        const wildPokemonInstance: Pokemon = {
            ...foundPokemon,
            level: wildPokemonLevel,
            stats: wildPokemonStats,
            currentHp: wildPokemonStats.hp,
            moves: availableMoves
        };

        const playerPokemon = this.getPlayer(interaction.user.id).pokemons[0];

        // Sauvegarde des statistiques initiales
        const initialPlayerStats = playerPokemon.stats ? { ...playerPokemon.stats } : undefined;
        const initialWildStats = { ...wildPokemonStats };

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`battle_${foundPokemon.name.toLowerCase()}`)
                    .setLabel('Combattre')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('flee')
                    .setLabel('Fuir')
                    .setStyle(ButtonStyle.Secondary)
            );

        this.battleService.battleStates[interaction.user.id] = {
            wildPokemon: wildPokemonInstance,
            playerPokemon: playerPokemon,
            initialPlayerStats,
            initialWildStats
        };

        interaction.reply({
            content: `${interaction.user.username}, tu as trouvé un **${foundPokemon.name}** sauvage niveau ${wildPokemonLevel} ! Que souhaites-tu faire ?`,
            components: [row]
        });
    }

    // Fonction pour obtenir les émojis de type d'un Pokémon
    public static getTypeEmojis(pokemon: Pokemon): string {
        return pokemon.types.map(type => TYPE_EMOJIS[type] || "❓").join(" ");
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