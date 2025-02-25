import 'dotenv/config';
import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import pkmnList from './data/pokemon_data.json';
import typeChartData from './data/type_chart.json';
import movesListData from './data/moves.json';
import {
    Pokemon, BattleState, Player, Location, Move, PokemonStats,
    Attacker, BattleEmbed, NodeCanvasImage, NodeCanvasContext2D,
    TypeChart, MovesList
} from './types/types';

// Cast des données importées vers les types corrects
const typeChart = typeChartData as TypeChart;
const movesList = movesListData as unknown as MovesList;

// Constants
const POKEMON_SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const HP_BAR_LENGTH = 10;
const PREFIX = "pkmn";

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

// Global state
const players: Record<string, Player> = {};
const battleStates: Record<string, BattleState> = {};

// Modifiez la fonction getPokemonByName
function getPokemonByName(name: string): Pokemon | null {
    const rawPokemon = Object.values(pkmnList).find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!rawPokemon) return null;

    const defaultStats: PokemonStats = {
        hp: 50, attack: 50, defense: 50,
        spAttack: 50, spDefense: 50, speed: 50
    };

    // Créer un Pokémon complet avec les valeurs par défaut pour les propriétés manquantes
    const pokemon: Pokemon = {
        baseStats: defaultStats,
        catchRate: 255,
        expYield: 50,
        growthRate: "medium-slow",
        learnset: {},
        level: 5,
        stats: defaultStats,
        currentHp: 50,
        moves: [],
        ...rawPokemon // Écraser les valeurs par défaut avec les données existantes
    };

    return pokemon;
}

const locations: Record<string, Location> = {
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
        pokemons: [getPokemonByName("Rattata"), getPokemonByName("Roucool"), getPokemonByName("Chenipan")].filter((p): p is Pokemon => p !== null)
    },
    "jadielle": {
        description: "La ville de Jadielle, où se trouve la première arène Pokémon.",
        routes: ["route-1"],
        actions: ["aller au centre Pokémon", "visiter l'arène"],
        pokemons: []
    }
};

const starters: Pokemon[] = [
    getPokemonByName("Bulbizarre"),
    getPokemonByName("Salamèche"),
    getPokemonByName("Carapuce")
].filter((pokemon): pokemon is Pokemon => pokemon !== null);

// Discord client setup
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// Utility functions
function calculateStats(pokemon: Pokemon, level: number): PokemonStats {
    const stats: PokemonStats = {
        hp: Math.floor(((2 * pokemon.baseStats.hp + 31 + Math.floor(252/4)) * level) / 100 + level + 10),
        attack: 0,
        defense: 0,
        spAttack: 0,
        spDefense: 0,
        speed: 0
    };
    
    ['attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
        stats[stat as keyof Omit<PokemonStats, 'hp'>] = Math.floor(
            ((2 * pokemon.baseStats[stat as keyof PokemonStats] + 31 + Math.floor(252/4)) * level) / 100 + 5
        );
    });
    
    return stats;
}

// Fonctions de combat
function calculateDamage(attacker: Pokemon, defender: Pokemon, move: Move): number {
    if (move.category === "Statut") return 0;
    
    const attackStat = move.category === "Physique" ? attacker.stats.attack : attacker.stats.spAttack;
    const defenseStat = move.category === "Physique" ? defender.stats.defense : defender.stats.spDefense;
    const typeMultiplier = calculateDamageMultiplier(move.type, defender.types);
    
    const baseDamage = Math.floor(
        ((2 * attacker.level / 5 + 2) * move.power * attackStat / defenseStat / 50 + 2) * 
        typeMultiplier * 
        (Math.random() * (1 - 0.85) + 0.85)
    );

    return baseDamage;
}

function drawKOCross(ctx: NodeCanvasContext2D, x: number, y: number, size: number): void {
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x - size/2, y - size/2);
    ctx.lineTo(x + size/2, y + size/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + size/2, y - size/2);
    ctx.lineTo(x - size/2, y + size/2);
    ctx.stroke();
}

function drawVS(ctx: NodeCanvasContext2D, x: number, y: number): void {
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#FF4400';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    
    ctx.strokeText('VS', x, y);
    
    const gradient = ctx.createLinearGradient(x - 30, y - 30, x + 30, y + 30);
    gradient.addColorStop(0, '#FF4400');
    gradient.addColorStop(0.5, '#FFFF00');
    gradient.addColorStop(1, '#FF4400');
    ctx.fillStyle = gradient;
    ctx.fillText('VS', x, y);

    ctx.shadowColor = '#FF4400';
    ctx.shadowBlur = 15;
    ctx.fillText('VS', x, y);
}

function drawPokemonWithKO(
    ctx: NodeCanvasContext2D,
    sprite: NodeCanvasImage,
    x: number,
    y: number,
    size: number,
    isKO: boolean
): void {
    ctx.drawImage(sprite, x, y, size, size);
    if (isKO) {
        drawKOCross(ctx, x + size/2, y + size/2, size);
    }
}

// Fonctions utilitaires
function calculateDamageMultiplier(attackType: string, defenderTypes: string[]): number {
    let multiplier = 1;
    defenderTypes.forEach(defenderType => {
        multiplier *= typeChart[attackType][defenderType];
    });
    return multiplier;
}

function createHPBar(currentHP: number, maxHP: number): string {
    const percentage = currentHP / maxHP;
    const filledBars = Math.round(HP_BAR_LENGTH * percentage);
    const emptyBars = HP_BAR_LENGTH - filledBars;
    
    const filledSection = "█".repeat(filledBars);
    const emptySection = "░".repeat(emptyBars);
    
    let color;
    if (percentage > 0.5) color = "🟩";
    else if (percentage > 0.2) color = "🟨";
    else color = "🟥";
    
    return `${color} ${filledSection}${emptySection} ${Math.ceil(currentHP)}/${maxHP}`;
}

function getTypeEmojis(pokemon: Pokemon): string {
    return pokemon.types.map(type => TYPE_EMOJIS[type] || "❓").join(" ");
}

async function createBattleImage(battleState: BattleState): Promise<Buffer> {
    const canvas = createCanvas(512, 256);
    const ctx = canvas.getContext('2d');

    // Définir un fond noir semi-transparent
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chargement des images
    const playerSprite = await loadImage(
        `${POKEMON_SPRITE_URL}${getPokemonId(battleState.playerPokemon.name)}.png`
    );
    const wildSprite = await loadImage(
        `${POKEMON_SPRITE_URL}${getPokemonId(battleState.wildPokemon.name)}.png`
    );

    // Position des Pokémon
    const playerX = 64;
    const wildX = 320;
    const y = 48;
    const size = 128;

    // Dessiner les Pokémon
    ctx.drawImage(playerSprite, playerX, y, size, size);
    if (battleState.playerPokemon.currentHp <= 0) {
        drawKOCross(ctx, playerX + size/2, y + size/2, size);
    }
    
    ctx.drawImage(wildSprite, wildX, y, size, size);
    if (battleState.wildPokemon.currentHp <= 0) {
        drawKOCross(ctx, wildX + size/2, y + size/2, size);
    }

    // Dessiner le VS
    drawVS(ctx, canvas.width / 2, canvas.height / 2);

    return canvas.toBuffer();
}

function getPokemonId(name: string): string {
    for (const [id, pokemon] of Object.entries(pkmnList)) {
        if (pokemon.name === name) {
            return id;
        }
    }
    return "0";
}

// Fonctions utilitaires pour l'interface
function createBattleEmbed(description: string): BattleEmbed {
    return {
        color: 0x0099FF,
        title: '⚔️ Combat Pokémon',
        description,
        fields: [],
        image: {
            url: 'attachment://battle.png'
        }
    };
}

function createExploreButton(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('explore')
                .setLabel('Explorer')
                .setStyle(ButtonStyle.Primary)
        );
}

// Event handlers
async function handleAttack(interaction: any, moveName: string): Promise<void> {
    const battleState = battleStates[interaction.user.id];
    if (!battleState) {
        await interaction.reply({ content: "Aucun combat en cours.", ephemeral: true });
        return;
    }

    const move = battleState.playerPokemon.moves.find(m => m.name.toLowerCase() === moveName.toLowerCase());
    if (!move) {
        await interaction.reply({ content: "Cette attaque n'existe pas.", ephemeral: true });
        return;
    }

    if (move.currentPP <= 0) {
        await interaction.reply({ content: "Plus de PP pour cette attaque !", ephemeral: true });
        return;
    }

    // Déterminer l'ordre des attaques
    const playerSpeed = battleState.playerPokemon.stats.speed;
    const wildSpeed = battleState.wildPokemon.stats.speed;
    
    // Choisir une attaque aléatoire pour le Pokémon sauvage
    const wildMoves = battleState.wildPokemon.moves;
    const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];

    let firstAttacker: Attacker;
    let secondAttacker: Attacker;

    if (playerSpeed >= wildSpeed) {
        firstAttacker = {
            isPlayer: true,
            pokemon: battleState.playerPokemon,
            opponent: battleState.wildPokemon,
            move: move
        };
        secondAttacker = {
            isPlayer: false,
            pokemon: battleState.wildPokemon,
            opponent: battleState.playerPokemon,
            move: wildMove
        };
    } else {
        firstAttacker = {
            isPlayer: false,
            pokemon: battleState.wildPokemon,
            opponent: battleState.playerPokemon,
            move: wildMove
        };
        secondAttacker = {
            isPlayer: true,
            pokemon: battleState.playerPokemon,
            opponent: battleState.wildPokemon,
            move: move
        };
    }

    let battleMessage = "";

    // Première attaque
    if (firstAttacker.isPlayer) move.currentPP--;
    const firstDamage = calculateDamage(firstAttacker.pokemon, firstAttacker.opponent, firstAttacker.move);
    firstAttacker.opponent.currentHp = Math.max(0, firstAttacker.opponent.currentHp - firstDamage);
    
    battleMessage = `**${firstAttacker.pokemon.name}** utilise ${firstAttacker.move.name} et inflige ${firstDamage} dégâts à **${firstAttacker.opponent.name}** !`;

    // Vérifier si le combat est terminé après la première attaque
    if (firstAttacker.opponent.currentHp === 0) {
        const battleImage = await createBattleImage(battleState);
        const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });
        
        delete battleStates[interaction.user.id];
        const defeatMessage = firstAttacker.isPlayer ? 
            `\nLe ${firstAttacker.opponent.name} sauvage est K.O. !` : 
            `\nTon ${firstAttacker.opponent.name} est K.O. !`;
        
        await interaction.reply({
            embeds: [createBattleEmbed(battleMessage + defeatMessage)],
            files: [attachment],
            components: [createExploreButton()]
        });
        return;
    }

    // Deuxième attaque
    if (secondAttacker.isPlayer) move.currentPP--;
    const secondDamage = calculateDamage(secondAttacker.pokemon, secondAttacker.opponent, secondAttacker.move);
    secondAttacker.opponent.currentHp = Math.max(0, secondAttacker.opponent.currentHp - secondDamage);
    
    battleMessage += `\n**${secondAttacker.pokemon.name}** utilise ${secondAttacker.move.name} et inflige ${secondDamage} dégâts à **${secondAttacker.opponent.name}** !`;

    // Vérifie si le combat est terminé après la seconde attaque
    if (secondAttacker.opponent.currentHp === 0) {
        const battleImage = await createBattleImage(battleState);
        const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });
        
        delete battleStates[interaction.user.id];
        const defeatMessage = secondAttacker.isPlayer ? 
            `\nLe ${secondAttacker.opponent.name} sauvage est K.O. !` : 
            `\nTon ${secondAttacker.opponent.name} est K.O. !`;
        
        await interaction.reply({
            embeds: [createBattleEmbed(battleMessage + defeatMessage)],
            files: [attachment],
            components: [createExploreButton()]
        });
        return;
    }

    // Le combat continue
    const row = new ActionRowBuilder<ButtonBuilder>();
    battleState.playerPokemon.moves.forEach(move => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`attack_${move.name.toLowerCase().replace(/\s+/g, '_')}`)
                .setLabel(`${move.name} (${move.currentPP}/${move.pp})`)
                .setStyle(ButtonStyle.Primary)
        );
    });

    const battleImage = await createBattleImage(battleState);
    const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

    await interaction.reply({
        embeds: [createBattleEmbed(battleMessage)],
        files: [attachment],
        content: `Que doit faire **${battleState.playerPokemon.name}** ?`,
        components: [row]
    });
}

// Fonction pour gérer la fuite
function handleFlee(interaction: any): void {
    delete battleStates[interaction.user.id];
    interaction.reply({
        content: "Tu as fui le combat !",
        components: [createExploreButton()]
    });
}

async function handleWildPokemonSearch(interaction: any, currentLocation: string): Promise<void> {
    const wildPokemons = locations[currentLocation].pokemons;
    if (wildPokemons.length === 0) {
        await interaction.reply({ content: "Il n'y a pas de Pokémon sauvages ici.", ephemeral: true });
        return;
    }
    
    const foundPokemon = wildPokemons[Math.floor(Math.random() * wildPokemons.length)];
    const wildPokemonLevel = 5;
    const wildPokemonStats = calculateStats(foundPokemon, wildPokemonLevel);

    const wildPokemon: Pokemon = {
        ...foundPokemon,
        level: wildPokemonLevel,
        stats: wildPokemonStats,
        currentHp: wildPokemonStats.hp,
        moves: [] // À implémenter : sélection des mouvements selon le niveau
    };

    const playerPokemon = players[interaction.user.id].pokemons[0];
    battleStates[interaction.user.id] = {
        playerPokemon,
        wildPokemon
    };

    const battleImage = await createBattleImage(battleStates[interaction.user.id]);
    const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

    const row = new ActionRowBuilder<ButtonBuilder>();
    playerPokemon.moves.forEach(move => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`attack_${move.name.toLowerCase().replace(/\s+/g, '_')}`)
                .setLabel(`${move.name} (${move.currentPP}/${move.pp})`)
                .setStyle(ButtonStyle.Primary)
        );
    });

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('flee')
            .setLabel('Fuir')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
        content: `Un ${wildPokemon.name} sauvage apparaît ! Que doit faire ${playerPokemon.name} ?`,
        files: [attachment],
        components: [row]
    });
}

// Event listeners
client.on('ready', () => {
    console.log(`Bot connecté en tant que ${client.user?.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === 'start') {
        if (players[message.author.id]) {
            message.reply("Tu as déjà commencé ton aventure !");
            return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>();
        starters.forEach(starter => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(starter.name.toLowerCase())
                    .setLabel(starter.name)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        await message.reply({
            content: "Choisis ton premier Pokémon !",
            components: [row]
        });
    }
});

// Event listeners pour les boutons
client.on('interactionCreate', async (interaction: any) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    // Gestion du choix du starter
    if (starters.some(s => s.name.toLowerCase() === customId)) {
        const starter = starters.find(s => s.name.toLowerCase() === customId)!;
        
        // Initialiser le joueur avec son starter
        players[interaction.user.id] = {
            pokemons: [{
                ...starter,
                moves: Object.entries(starter.learnset)
                    .filter(([level]) => parseInt(level) <= 5)
                    .flatMap(([_, moves]) => moves)
                    .map(moveName => ({
                        ...movesList[moveName],
                        currentPP: movesList[moveName].pp
                    }))
            }],
            currentLocation: "bourg-palette"
        };

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('explore')
                    .setLabel('Explorer')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({
            content: `Tu as choisi ${starter.name} comme Pokémon de départ ! Ton aventure commence à Bourg-Palette.`,
            components: [row]
        });
        return;
    }

    // Gestion de l'exploration
    if (customId === 'explore') {
        const player = players[interaction.user.id];
        if (!player) {
            await interaction.reply({
                content: "Tu dois d'abord choisir un Pokémon de départ avec la commande !pkmn start",
                ephemeral: true
            });
            return;
        }

        const location = locations[player.currentLocation];
        const row = new ActionRowBuilder<ButtonBuilder>();

        // Ajouter les boutons pour chaque action possible
        location.actions.forEach(action => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(action.toLowerCase().replace(/ /g, '_'))
                    .setLabel(action)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        // Ajouter les boutons pour chaque route disponible
        location.routes.forEach(route => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`goto_${route}`)
                    .setLabel(`Aller à ${route}`)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        await interaction.reply({
            content: `Tu es à ${player.currentLocation}.\n${location.description}`,
            components: [row]
        });
        return;
    }

    // Gestion des déplacements
    if (customId.startsWith('goto_')) {
        const destination = customId.replace('goto_', '');
        const player = players[interaction.user.id];
        
        if (!locations[player.currentLocation].routes.includes(destination)) {
            await interaction.reply({
                content: "Tu ne peux pas aller là-bas depuis ta position actuelle.",
                ephemeral: true
            });
            return;
        }

        player.currentLocation = destination;
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('explore')
                    .setLabel('Explorer')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({
            content: `Tu arrives à ${destination}.\n${locations[destination].description}`,
            components: [row]
        });
        return;
    }

    // Gestion des attaques
    if (customId.startsWith('attack_')) {
        const moveName = customId.replace('attack_', '').replace(/_/g, ' ');
        await handleAttack(interaction, moveName);
        return;
    }

    // Gestion de la fuite
    if (customId === 'flee') {
        handleFlee(interaction);
        return;
    }

    // Gestion de la recherche de Pokémon sauvages
    if (customId === 'chercher_des_pokémon_sauvages') {
        const player = players[interaction.user.id];
        await handleWildPokemonSearch(interaction, player.currentLocation);
        return;
    }
});

// Connecter le bot
client.login(process.env.TOKEN); 