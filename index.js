require('dotenv').config();

const pkmnList = require('./pokemon_data.json');
const typeChart = require('./type_chart.json');
const movesList = require('./moves.json');

// Ajoutez ces constantes au début du fichier
const POKEMON_SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const HP_BAR_LENGTH = 10; // Longueur de la barre de vie en caractères

// Ajoutez ces constantes pour les émojis de type
const TYPE_EMOJIS = {
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

// Ajoutez ces imports au début du fichier
const Canvas = require('canvas');
const { AttachmentBuilder } = require('discord.js');

// Fonction pour récupérer un Pokémon par son nom depuis pkmnList
function getPokemonByName(name) {
    return Object.values(pkmnList).find(pokemon => pokemon.name.toLowerCase() === name.toLowerCase()) || null;
}

// Fonction pour vérifier si un Custom ID correspond à un starter
function isStarterByCustomId(customId) {
    return starters.some(starter => starter.name.toLowerCase() === customId.toLowerCase());
}

const starters = [
    getPokemonByName("Bulbizarre"),
    getPokemonByName("Salamèche"),
    getPokemonByName("Carapuce")
];

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const PREFIX = "pkmn";  // Préfixe de toutes les commandes

// Base de données simple des joueurs et des lieux
const players = {};
const locations = {
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
        pokemons: [getPokemonByName("Rattata"), getPokemonByName("Roucool"), getPokemonByName("Chenipan")]
    },
    "jadielle": {
        description: "La ville de Jadielle, où se trouve la première arène Pokémon.",
        routes: ["route-1"],
        actions: ["aller au centre Pokémon", "visiter l'arène"],
        pokemons: []
    }
};

// Après la déclaration des locations
const battleStates = {};

client.once('ready', () => {
    console.log(`${client.user.tag} est prêt à l'action !`);
});

// Command handler
client.on('messageCreate', message => {
    // Vérifie que le message commence par le préfixe et ignore les messages venant de bots
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    // Supprime le préfixe du message et sépare la commande et les arguments
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === 'start') {
        handleStartCommand(message);
    } else if (command === 'explore') {
        handleExploreCommand(message);
    } else if (command === 'status') {
        handleStatusCommand(message);
    }
});

// Fonction pour gérer la commande /start
function handleStartCommand(message) {
    if (players[message.author.id]) {
        message.reply(`Tu as déjà commencé ton aventure, ${message.author.username} ! Utilise ${PREFIX} explore pour explorer les environs.`);
    } else {
        players[message.author.id] = {};
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(starters[0].name.toLowerCase())
                    .setLabel(starters[0].name)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(starters[1].name.toLowerCase())
                    .setLabel(starters[1].name)
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(starters[2].name.toLowerCase())
                    .setLabel(starters[2].name)
                    .setStyle(ButtonStyle.Primary)
            );

        message.reply({ content: `Bienvenue dans le monde de Pokémon, ${message.author.username} ! Choisis ton starter :`, components: [row] });
    }
}

// Fonction pour gérer la commande /explore
function handleExploreCommand(interaction) {
    if (!players[interaction.user.id]) {
        interaction.reply({ content: "Utilise d'abord pkmn start pour commencer ton aventure !", ephemeral: true });
        return;
    }

    const currentLocation = players[interaction.user.id].location;
    if (!locations[currentLocation]) {
        interaction.reply({ content: "La localisation actuelle est invalide. Veuillez redémarrer l'aventure.", ephemeral: true });
        return;
    }
    const availableRoutes = locations[currentLocation].routes;
    const availableActions = locations[currentLocation].actions;

    const row = new ActionRowBuilder();
    availableRoutes.forEach(route => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(route)
                .setLabel(route.charAt(0).toUpperCase() + route.slice(1))
                .setStyle(ButtonStyle.Primary)
        );
    });
    availableActions.forEach(action => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`action_${action.replace(/\s+/g, '_').toLowerCase()}`)
                .setLabel(action)
                .setStyle(ButtonStyle.Secondary)
        );
    });

    interaction.reply({ 
        content: `Où veux-tu aller depuis **${currentLocation}** ou quelle action veux-tu entreprendre ?`, 
        components: [row] 
    });
}

// Fonction pour gérer la commande /status
function handleStatusCommand(message) {
    if (!players[message.author.id]) {
        message.reply("Utilise d'abord pkmn start pour commencer ton aventure !");
    } else {
        const location = players[message.author.id].location;
        const pokemons = players[message.author.id].pokemons.map(pokemon => pokemon.name);
        message.reply(`Tu es actuellement à **${location}**. Tes Pokémon : ${pokemons.join(', ')}. Utilise ${PREFIX} explore pour continuer ton exploration.`);
    }
}

// Créez une nouvelle fonction pour générer le bouton Explorer
function createExploreButton() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('explore_location')
                .setLabel('Explorer')
                .setStyle(ButtonStyle.Success)
        );
}

// Écoute les interactions avec les boutons
client.on('interactionCreate', interaction => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    if (!players[userId]) {
        interaction.reply({ content: "Utilise d'abord pkmn start pour commencer ton aventure !", ephemeral: true });
        return;
    }

    if (interaction.customId === 'explore_location') {
        handleExploreCommand(interaction);
    } else if (isStarterByCustomId(interaction.customId)) {
        handleStarterSelection(interaction);
    } else if (interaction.customId.startsWith('action_')) {
        handleLocationAction(interaction);
    } else if (interaction.customId.startsWith('battle_')) {
        handleBattle(interaction);
    } else if (interaction.customId.startsWith('attack_')) {
        const moveName = interaction.customId.replace('attack_', '').replace(/_/g, ' ');
        handleAttack(interaction, moveName);
    } else if (interaction.customId === 'flee') {
        handleFlee(interaction);
    } else {
        handleLocationExploration(interaction);
    }
});

// Fonction pour gérer la sélection de starter
function handleStarterSelection(interaction) {
    const userId = interaction.user.id;
    let chosenStarter = starters.find(starter => starter.name.toLowerCase() === interaction.customId.toLowerCase());

    if (chosenStarter) {
        const level = 5;
        const stats = calculateStats(chosenStarter, level);
        
        // Récupération des attaques de départ depuis le learnset
        const starterMoves = Object.entries(chosenStarter.learnset)
            .filter(([reqLevel]) => parseInt(reqLevel) <= level)
            .flatMap(([, moves]) => moves)
            .slice(0, 4); // Maximum 4 attaques

        chosenStarter = {
            ...chosenStarter,
            level: level,
            exp: 0,
            maxExp: 100,
            stats: stats,
            currentHp: stats.hp,
            moves: starterMoves.map(moveId => ({
                ...movesList[moveId],
                currentPP: movesList[moveId].pp
            }))
        };
        
        players[userId] = { 
            location: 'bourg-palette', 
            pokemons: [chosenStarter]
        };
        
        interaction.reply({
            content: 
                `${interaction.user.username}, tu as choisi **${chosenStarter.name}** niveau ${level} comme starter !\n` +
                `Stats: PV ${stats.hp}, Attaque ${stats.attack}, Défense ${stats.defense}, ` +
                `Attaque Spé ${stats.spAttack}, Défense Spé ${stats.spDefense}, Vitesse ${stats.speed}\n` +
                `Attaques: ${chosenStarter.moves.map(move => move.name).join(", ")}`,
            components: [createExploreButton()]
        });
    }
}

// Fonction pour gérer l'exploration de lieux
function handleLocationExploration(interaction) {
    const userId = interaction.user.id;
    const currentLocation = players[userId].location;
    if (!locations[currentLocation]) {
        interaction.reply({ content: "La localisation actuelle est invalide. Veuillez redémarrer l'aventure.", ephemeral: true });
        return;
    }
    const availableRoutes = locations[currentLocation].routes;

    if (availableRoutes.includes(interaction.customId)) {
        players[userId].location = interaction.customId;
        const description = locations[interaction.customId].description;
        interaction.reply({
            content: `Tu es maintenant à **${interaction.customId}**. ${description}`,
            components: [createExploreButton()]
        });
    } else {
        interaction.reply({ content: "Ce chemin n'est pas disponible.", ephemeral: true });
    }
}

// Fonction pour gérer les actions dans les lieux
function handleLocationAction(interaction) {
    const userId = interaction.user.id;
    const currentLocation = players[userId].location;
    if (!locations[currentLocation]) {
        interaction.reply({ content: "La localisation actuelle est invalide. Veuillez redémarrer l'aventure.", ephemeral: true });
        return;
    }
    const action = interaction.customId.replace('action_', '').replace(/_/g, ' ');

    if (action === 'chercher des pokémon sauvages') {
        handleWildPokemonSearch(interaction, currentLocation);
    } else {
        interaction.reply({
            content: `${interaction.user.username}, tu as choisi de **${action}** à **${currentLocation}**.`,
            components: [createExploreButton()]
        });
    }
}

// Fonction pour gérer la recherche de Pokémon sauvages
function handleWildPokemonSearch(interaction, currentLocation) {
    const wildPokemons = locations[currentLocation].pokemons;
    if (wildPokemons.length === 0) {
        interaction.reply({ content: "Il n'y a pas de Pokémon sauvages ici.", ephemeral: true });
        return;
    }
    
    const foundPokemon = wildPokemons[Math.floor(Math.random() * wildPokemons.length)];
    const wildPokemonLevel = 5;
    const wildPokemonStats = calculateStats(foundPokemon, wildPokemonLevel);

    // Récupération des attaques disponibles pour le niveau du Pokémon
    const availableMoves = [];
    Object.entries(foundPokemon.learnset).forEach(([level, moves]) => {
        if (parseInt(level) <= wildPokemonLevel) {
            moves.forEach(moveId => {
                const move = movesList[moveId];
                if (move) {
                    availableMoves.push({
                        ...move,
                        currentPP: move.pp
                    });
                }
            });
        }
    });

    const wildPokemonInstance = {
        ...foundPokemon,
        level: wildPokemonLevel,
        stats: wildPokemonStats,
        currentHp: wildPokemonStats.hp,
        moves: availableMoves
    };

    const row = new ActionRowBuilder()
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

    battleStates[interaction.user.id] = {
        wildPokemon: wildPokemonInstance,
        playerPokemon: players[interaction.user.id].pokemons[0]
    };

    interaction.reply({ 
        content: `${interaction.user.username}, tu as trouvé un **${foundPokemon.name}** sauvage niveau ${wildPokemonLevel} ! Que souhaites-tu faire ?`,
        components: [row]
    });
}

function calculateDamageMultiplier(attackType, defenderTypes) {
    let multiplier = 1;
    defenderTypes.forEach(defenderType => {
        multiplier *= typeChart[attackType][defenderType];
    });
    return multiplier;
}

// Ajoutez cette fonction utilitaire pour créer la barre de vie
function createHPBar(currentHP, maxHP) {
    const percentage = currentHP / maxHP;
    const filledBars = Math.round(HP_BAR_LENGTH * percentage);
    const emptyBars = HP_BAR_LENGTH - filledBars;
    
    const filledSection = "█".repeat(filledBars);
    const emptySection = "░".repeat(emptyBars);
    
    // Change la couleur en fonction du pourcentage de vie
    let color;
    if (percentage > 0.5) color = "🟩"; // Vert
    else if (percentage > 0.2) color = "🟨"; // Jaune
    else color = "🟥"; // Rouge
    
    return `${color} ${filledSection}${emptySection} ${Math.ceil(currentHP)}/${maxHP}`;
}

// Ajoutez cette fonction pour obtenir les émojis de type d'un Pokémon
function getTypeEmojis(pokemon) {
    return pokemon.types.map(type => TYPE_EMOJIS[type] || "❓").join(" ");
}

// Ajoutez cette fonction pour dessiner une croix rouge sur un Pokémon KO
function drawKOCross(ctx, x, y, size) {
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    
    // Dessiner la première ligne de la croix (\)
    ctx.beginPath();
    ctx.moveTo(x - size/2, y - size/2);
    ctx.lineTo(x + size/2, y + size/2);
    ctx.stroke();
    
    // Dessiner la deuxième ligne de la croix (/)
    ctx.beginPath();
    ctx.moveTo(x + size/2, y - size/2);
    ctx.lineTo(x - size/2, y + size/2);
    ctx.stroke();
}

// Modifiez la fonction createBattleImage pour utiliser battleState
async function createBattleImage(battleState) {
    const canvas = Canvas.createCanvas(512, 256);
    const ctx = canvas.getContext('2d');

    // Définir un fond noir semi-transparent
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chargement des images
    const playerSprite = await Canvas.loadImage(
        `${POKEMON_SPRITE_URL}${getPokemonId(battleState.playerPokemon.name)}.png`
    );
    const wildSprite = await Canvas.loadImage(
        `${POKEMON_SPRITE_URL}${getPokemonId(battleState.wildPokemon.name)}.png`
    );

    // Position des Pokémon
    const playerX = 64;
    const wildX = 320;
    const y = 48;
    const size = 128;

    // Dessiner le Pokémon du joueur à gauche
    ctx.drawImage(playerSprite, playerX, y, size, size);
    if (battleState.playerPokemon.currentHp <= 0) {
        drawKOCross(ctx, playerX + size/2, y + size/2, size);
    }
    
    // Dessiner le Pokémon sauvage à droite
    ctx.drawImage(wildSprite, wildX, y, size, size);
    if (battleState.wildPokemon.currentHp <= 0) {
        drawKOCross(ctx, wildX + size/2, y + size/2, size);
    }

    // Configurer le style du VS
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Créer l'effet d'ombre pour le VS
    ctx.fillStyle = '#FF4400';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    
    // Position du VS
    const x = canvas.width / 2;
    const y2 = canvas.height / 2;

    // Dessiner l'ombre du VS
    ctx.strokeText('VS', x, y2);
    
    // Dessiner le VS avec un dégradé
    const gradient = ctx.createLinearGradient(x - 30, y2 - 30, x + 30, y2 + 30);
    gradient.addColorStop(0, '#FF4400');
    gradient.addColorStop(0.5, '#FFFF00');
    gradient.addColorStop(1, '#FF4400');
    ctx.fillStyle = gradient;
    ctx.fillText('VS', x, y2);

    // Ajouter un effet de lueur
    ctx.shadowColor = '#FF4400';
    ctx.shadowBlur = 15;
    ctx.fillText('VS', x, y2);

    return canvas.toBuffer();
}

// Modifiez la fonction handleBattle pour utiliser l'image fusionnée
async function handleBattle(interaction) {
    const battleState = battleStates[interaction.user.id];
    if (!battleState) {
        interaction.reply({ content: "Aucun combat en cours.", ephemeral: true });
        return;
    }

    const playerPokemon = battleState.playerPokemon;
    const wildPokemon = battleState.wildPokemon;

    const playerMaxHP = playerPokemon.stats.hp;
    const wildMaxHP = wildPokemon.stats.hp;

    // Créer l'image de combat
    const battleImage = await createBattleImage(battleState);
    
    // Créer l'attachment pour Discord
    const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

    const battleEmbed = {
        color: 0x0099FF,
        title: '⚔️ Combat Pokémon',
        description: '\u200b',
        fields: [
            {
                name: `${getTypeEmojis(playerPokemon)} ${playerPokemon.name} Nv.${playerPokemon.level}`,
                value: `${createHPBar(playerPokemon.currentHp, playerMaxHP)}`,
                inline: true
            },
            {
                name: '\u200b',
                value: 'VS',
                inline: true
            },
            {
                name: `${getTypeEmojis(wildPokemon)} ${wildPokemon.name} Nv.${wildPokemon.level}`,
                value: `${createHPBar(wildPokemon.currentHp, wildMaxHP)}`,
                inline: true
            }
        ],
        image: {
            url: 'attachment://battle.png'
        }
    };

    const row = new ActionRowBuilder();
    battleState.playerPokemon.moves.forEach(move => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`attack_${move.name.toLowerCase().replace(/\s+/g, '_')}`)
                .setLabel(`${move.name} (${move.currentPP}/${move.pp})`)
                .setStyle(ButtonStyle.Primary)
        );
    });

    interaction.reply({
        embeds: [battleEmbed],
        files: [attachment],
        content: `Que doit faire **${battleState.playerPokemon.name}** ?`,
        components: [row]
    });
}

// Modifiez la fonction handleAttack pour utiliser le même format que handleBattle
async function handleAttack(interaction, moveName) {
    const battleState = battleStates[interaction.user.id];
    if (!battleState) {
        interaction.reply({ content: "Aucun combat en cours.", ephemeral: true });
        return;
    }

    const playerMove = battleState.playerPokemon.moves.find(m => m.name.toLowerCase() === moveName.toLowerCase());
    if (!playerMove || playerMove.currentPP <= 0) {
        interaction.reply({ content: "Cette attaque ne peut pas être utilisée !", ephemeral: true });
        return;
    }

    // Sélection de l'attaque du Pokémon sauvage
    const wildMoves = battleState.wildPokemon.moves;
    const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];

    let battleMessage = "";
    const playerSpeed = battleState.playerPokemon.stats.speed;
    const wildSpeed = battleState.wildPokemon.stats.speed;

    // Détermine qui attaque en premier en fonction de la vitesse
    const firstAttacker = playerSpeed >= wildSpeed ? 
        { pokemon: battleState.playerPokemon, opponent: battleState.wildPokemon, move: playerMove, isPlayer: true } : 
        { pokemon: battleState.wildPokemon, opponent: battleState.playerPokemon, move: wildMove, isPlayer: false };
    
    const secondAttacker = firstAttacker.isPlayer ? 
        { pokemon: battleState.wildPokemon, opponent: battleState.playerPokemon, move: wildMove, isPlayer: false } : 
        { pokemon: battleState.playerPokemon, opponent: battleState.wildPokemon, move: playerMove, isPlayer: true };

    // Première attaque
    if (firstAttacker.isPlayer) playerMove.currentPP--;
    const firstDamage = calculateDamage(firstAttacker.pokemon, firstAttacker.opponent, firstAttacker.move);
    firstAttacker.opponent.currentHp = Math.max(0, firstAttacker.opponent.currentHp - firstDamage);
    
    battleMessage += `**${firstAttacker.pokemon.name}** utilise ${firstAttacker.move.name} et inflige ${firstDamage} dégâts à **${firstAttacker.opponent.name}** !`;

    // Créer l'image de combat
    const battleImage = await createBattleImage(battleState);
    
    // Créer l'attachment pour Discord
    const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

    const createBattleEmbed = (message) => {
        return {
            color: 0x0099FF,
            title: '⚔️ Combat Pokémon',
            description: '\u200b',
            fields: [
                {
                    name: `${getTypeEmojis(battleState.playerPokemon)} ${battleState.playerPokemon.name} Nv.${battleState.playerPokemon.level}`,
                    value: createHPBar(battleState.playerPokemon.currentHp, battleState.playerPokemon.stats.hp),
                    inline: true
                },
                {
                    name: '\u200b',
                    value: 'VS',
                    inline: true
                },
                {
                    name: `${getTypeEmojis(battleState.wildPokemon)} ${battleState.wildPokemon.name} Nv.${battleState.wildPokemon.level}`,
                    value: createHPBar(battleState.wildPokemon.currentHp, battleState.wildPokemon.stats.hp),
                    inline: true
                },
                {
                    name: 'Déroulement du combat',
                    value: message,
                    inline: false
                }
            ],
            image: {
                url: 'attachment://battle.png'
            }
        };
    };

    // Modifiez les reply pour utiliser le nouvel embed
    if (firstAttacker.opponent.currentHp === 0) {
        delete battleStates[interaction.user.id];
        const defeatMessage = firstAttacker.isPlayer ? 
            `\nLe ${firstAttacker.opponent.name} sauvage est K.O. !` : 
            `\nTon ${firstAttacker.opponent.name} est K.O. !`;
        
        interaction.reply({
            embeds: [createBattleEmbed(battleMessage + defeatMessage)],
            files: [attachment],
            components: [createExploreButton()]
        });
        return;
    }

    // Deuxième attaque
    if (secondAttacker.isPlayer) playerMove.currentPP--;
    const secondDamage = calculateDamage(secondAttacker.pokemon, secondAttacker.opponent, secondAttacker.move);
    secondAttacker.opponent.currentHp = Math.max(0, secondAttacker.opponent.currentHp - secondDamage);
    
    battleMessage += `\n**${secondAttacker.pokemon.name}** utilise ${secondAttacker.move.name} et inflige ${secondDamage} dégâts à **${secondAttacker.opponent.name}** !`;

    // Vérifie si le combat est terminé après la seconde attaque
    if (secondAttacker.opponent.currentHp === 0) {
        delete battleStates[interaction.user.id];
        const defeatMessage = secondAttacker.isPlayer ? 
            `\nLe ${secondAttacker.opponent.name} sauvage est K.O. !` : 
            `\nTon ${secondAttacker.opponent.name} est K.O. !`;
        
        interaction.reply({
            embeds: [createBattleEmbed(battleMessage + defeatMessage)],
            files: [attachment],
            components: [createExploreButton()]
        });
        return;
    }

    // Le combat continue
    const row = new ActionRowBuilder();
    battleState.playerPokemon.moves.forEach(move => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`attack_${move.name.toLowerCase().replace(/\s+/g, '_')}`)
                .setLabel(`${move.name} (${move.currentPP}/${move.pp})`)
                .setStyle(ButtonStyle.Primary)
        );
    });

    interaction.reply({
        embeds: [createBattleEmbed(battleMessage)],
        files: [attachment],
        content: `Que doit faire **${battleState.playerPokemon.name}** ?`,
        components: [row]
    });
}

// Fonction utilitaire pour calculer les dégâts
function calculateDamage(attacker, defender, move) {
    if (move.category === "Statut") return 0;
    
    const attackStat = move.category === "Physique" ? attacker.stats.attack : attacker.stats.spAttack;
    const defenseStat = move.category === "Physique" ? defender.stats.defense : defender.stats.spDefense;
    const typeMultiplier = calculateDamageMultiplier(move.type, defender.types);
    
    // Formule de dégâts Pokémon
    const baseDamage = Math.floor(
        ((2 * attacker.level / 5 + 2) * move.power * attackStat / defenseStat / 50 + 2) * 
        typeMultiplier * 
        (Math.random() * (1 - 0.85) + 0.85)
    );

    return baseDamage;
}

function getStatusMessage(effectType) {
    switch(effectType) {
        case "burn": return "brûlé";
        case "freeze": return "gelé";
        case "paralysis": return "paralysé";
        case "sleep": return "endormi";
        case "poison": return "empoisonné";
        default: return "";
    }
}

function handleFlee(interaction) {
    delete battleStates[interaction.user.id];
    interaction.reply({
        content: "Tu as fui le combat !",
        components: [createExploreButton()]
    });
}

// Ajoutez cette fonction après les autres fonctions utilitaires
function calculateStats(pokemon, level) {
    const stats = {};
    
    // Calcul des PV
    stats.hp = Math.floor(((2 * pokemon.baseStats.hp + 31 + Math.floor(252/4)) * level) / 100 + level + 10);
    
    // Calcul des autres stats
    const otherStats = ['attack', 'defense', 'spAttack', 'spDefense', 'speed'];
    otherStats.forEach(stat => {
        stats[stat] = Math.floor(((2 * pokemon.baseStats[stat] + 31 + Math.floor(252/4)) * level) / 100 + 5);
    });
    
    return stats;
}

// Ajoutez cette fonction utilitaire pour obtenir l'ID du Pokémon
function getPokemonId(pokemonName) {
    for (const [id, pokemon] of Object.entries(pkmnList)) {
        if (pokemon.name === pokemonName) {
            return id;
        }
    }
    return "0"; // Sprite par défaut si non trouvé
}

// Connecter le bot
client.login(process.env.TOKEN);
