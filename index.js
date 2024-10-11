require('dotenv').config();
const pkmnList = require('./pokemon_data.json');

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

// Fonction pour récupérer un Pokémon par son nom depuis pkmnList
function getPokemonByName(name) {
    return Object.values(pkmnList).find(pokemon => pokemon.name.toLowerCase() === name.toLowerCase()) || null;
}

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
function handleExploreCommand(message) {
    if (!players[message.author.id]) {
        message.reply("Utilise d'abord pkmn start pour commencer ton aventure !");
        return;
    }

    const currentLocation = players[message.author.id].location;
    if (!locations[currentLocation]) {
        message.reply("La localisation actuelle est invalide. Veuillez redémarrer l'aventure.");
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

    message.reply({ content: `Où veux-tu aller depuis **${currentLocation}** ou quelle action veux-tu entreprendre ?`, components: [row] });
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

// Écoute les interactions avec les boutons
client.on('interactionCreate', interaction => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    if (!players[userId]) {
        interaction.reply({ content: "Utilise d'abord pkmn start pour commencer ton aventure !", ephemeral: true });
        return;
    }

    if (isStarterByCustomId(interaction.customId)) {
        handleStarterSelection(interaction);
    } else if (interaction.customId.startsWith('action_')) {
        handleLocationAction(interaction);
    } else {
        handleLocationExploration(interaction);
    }
});

// Fonction pour gérer la sélection de starter
function handleStarterSelection(interaction) {
    const userId = interaction.user.id;
    let chosenStarter = starters.find(starter => starter.name.toLowerCase() === interaction.customId.toLowerCase());

    if (chosenStarter) {
        players[userId] = { location: 'bourg-palette', pokemons: [chosenStarter] };
        interaction.reply(`${interaction.user.username}, tu as choisi **${chosenStarter.name}** comme starter ! Utilise ${PREFIX} explore pour commencer ton aventure.`);
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
        interaction.reply(`Tu es maintenant à **${interaction.customId}**. ${description}`);
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

    if (action === 'chercher des Pokémon sauvages') {
        handleWildPokemonSearch(interaction, currentLocation);
    } else {
        interaction.reply(`${interaction.user.username}, tu as choisi de **${action}** à **${currentLocation}**.`);
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
    interaction.reply(`${interaction.user.username}, tu as trouvé un **${foundPokemon.name}** sauvage ! Que souhaites-tu faire ?`);
}

// Connecter le bot
client.login(process.env.TOKEN);
