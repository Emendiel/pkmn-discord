import { config } from 'dotenv';
import { Canvas, loadImage } from 'canvas';
import { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  AttachmentBuilder,
  Message,
  ButtonInteraction,
  Interaction,
  EmbedField,
  ActivityType
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { Pokemon, Stats, Move, MovesListType } from './models/Pokemon';
import { BattleState } from './models/Battle';
import { Player, Location } from './models/Utils';
import { POKEMON_SPRITE_URL, HP_BAR_LENGTH, TYPE_EMOJIS, PREFIX } from './utils/Utils';
import { PokemonService } from './services/PokemonService';
import { BattleService } from './services/BattleService';
import { GameService } from './services/GameService';


config();

// Initialisation des services
const pokemonService = new PokemonService();
const battleService = new BattleService();
const gameService = new GameService();

// Import des données
const pkmnList = pokemonService.getPokemonList();
const typeChart = pokemonService.getTypeChart();
const movesList = pokemonService.getMovesList();

// Collections de données
const players: Record<string, Player> = {};
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
    pokemons: [
      pokemonService.getPokemonByName("Rattata"), 
      pokemonService.getPokemonByName("Roucool"), 
      pokemonService.getPokemonByName("Chenipan")
    ].filter((pokemon): pokemon is Pokemon => pokemon !== null)
  },
  "jadielle": {
    description: "La ville de Jadielle, où se trouve la première arène Pokémon.",
    routes: ["route-1"],
    actions: ["aller au centre Pokémon", "visiter l'arène"],
    pokemons: []
  }
};

const battleStates: Record<string, BattleState> = {};

// Ajouter ce type personnalisé au début du fichier
type NodeCanvasRenderingContext2D = any;

// Fonction pour vérifier si un Custom ID correspond à un starter
function isStarterByCustomId(customId: string): boolean {
  return starters.some(starter => starter.name.toLowerCase() === customId.toLowerCase());
}

const starters: Pokemon[] = pokemonService.getStarters();

// Initialisation du client Discord
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});

client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user?.tag}!`);
  client.user?.setActivity('Pokémon', { type: ActivityType.Playing });
  
  // Charger les données de jeu au démarrage
  loadGameData();
  
  // Configurer une sauvegarde automatique toutes les 5 minutes
  setInterval(saveGameData, 5 * 60 * 1000);
});

// Command handler
client.on('messageCreate', (message: Message) => {
  // Vérifie que le message commence par le préfixe et ignore les messages venant de bots
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  // Supprime le préfixe du message et sépare la commande et les arguments
  const args: string[] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command: string = args.shift()?.toLowerCase() || '';

  if (command === 'start') {
    handleStartCommand(message);
  } else if (command === 'explore') {
    handleExploreCommand(message);
  } else if (command === 'status') {
    handleStatusCommand(message);
  } else if (command === 'battle' && args[0] === 'stats') {
    handleBattleStatsCommand(message, args);
  } else if (command === 'reset') {
    handleResetGameCommand(message);
  } else if (command === 'save') {
    saveGameData();
    message.reply("🔄 Jeu sauvegardé avec succès !");
  }
});

// Fonction pour gérer la commande /start
function handleStartCommand(message: Message): void {
  if (gameService.isPlayer(message.author.id)) {
    message.reply(`Tu as déjà commencé ton aventure, ${message.author.username} ! Utilise ${PREFIX} explore pour explorer les environs.`);
  } else {
    gameService.addPlayer(message.author.id, {} as Player);
    const row = new ActionRowBuilder<ButtonBuilder>()
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
function handleExploreCommand(interaction: Message | ButtonInteraction): void {
  const userId = interaction instanceof Message ? interaction.author.id : interaction.user.id;
  
  if (!gameService.isPlayer(userId)) {
    const reply = { content: "Utilise d'abord pkmn start pour commencer ton aventure !", ephemeral: true };
    
    if (interaction instanceof Message) {
      interaction.reply(reply);
    } else {
      interaction.reply(reply);
    }
    return;
  }

  const currentLocation = gameService.getCurrentLocation(userId);
  if (!gameService.isLocation(currentLocation)) {
    const reply = { content: "La localisation actuelle est invalide. Veuillez redémarrer l'aventure.", ephemeral: true };
    
    if (interaction instanceof Message) {
      interaction.reply(reply);
    } else {
      interaction.reply(reply);
    }
    return;
  }
  
  const availableRoutes = gameService.getLocation(currentLocation).routes;
  const availableActions = gameService.getLocation(currentLocation).actions;

  const row = new ActionRowBuilder<ButtonBuilder>();
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
function handleStatusCommand(message: Message): void {
  if (!gameService.isPlayer(message.author.id)) {
    message.reply("Utilise d'abord pkmn start pour commencer ton aventure !");
  } else {
    const location = gameService.getPlayer(message.author.id).location;
    const pokemons = gameService.getPlayer(message.author.id).pokemons.map(pokemon => pokemon.name);
    message.reply(`Tu es actuellement à **${location}**. Tes Pokémon : ${pokemons.join(', ')}. Utilise ${PREFIX} explore pour continuer ton exploration.`);
  }
}

// Fonction pour créer le bouton Explorer
function createExploreButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('explore_location')
        .setLabel('Explorer')
        .setStyle(ButtonStyle.Success)
    );
}

// Écoute les interactions avec les boutons
client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isButton()) return;
  
  const buttonId = interaction.customId;
  
  // Gérer les boutons de réinitialisation
  if (buttonId === 'confirm_reset') {
    await handleConfirmReset(interaction as ButtonInteraction);
    return;
  } else if (buttonId === 'cancel_reset') {
    await interaction.update({ 
      content: "Réinitialisation annulée. Ta progression est sauvegardée.", 
      components: [] 
    });
    return;
  } else if (buttonId === 'battle_stats') {
    await handleBattleStatsInteraction(interaction as ButtonInteraction);
    return;
  } else if (buttonId === 'return_to_battle') {
    await interaction.reply({ content: "Retour au combat !", ephemeral: true });
    return;
  }
  
  const userId = interaction.user.id;
  if (!gameService.isPlayer(userId)) {
    interaction.reply({ content: "Utilise d'abord pkmn start pour commencer ton aventure !", ephemeral: true });
    return;
  }

  if (buttonId === 'explore_location') {
    handleExploreCommand(interaction);
  } else if (isStarterByCustomId(buttonId)) {
    handleStarterSelection(interaction);
  } else if (buttonId.startsWith('action_')) {
    handleLocationAction(interaction);
  } else if (buttonId.startsWith('battle_')) {
    handleBattle(interaction);
  } else if (buttonId.startsWith('attack_')) {
    const moveName = buttonId.replace('attack_', '').replace(/_/g, ' ');
    handleAttack(interaction, moveName);
  } else if (buttonId === 'flee') {
    handleFlee(interaction);
  } else {
    handleLocationExploration(interaction);
  }
});

// Fonction pour gérer la sélection de starter
function handleStarterSelection(interaction: ButtonInteraction): void {
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

    const moves = starterMoves.map(moveId => ({
      ...pokemonService.getMoveByID(moveId),
      currentPP: pokemonService.getMoveByID(moveId)?.pp
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
    
    gameService.updatePlayerLocation(userId, 'bourg-palette');
    gameService.addPlayerPokemon(userId, starterPokemon);

    interaction.reply({
      content: 
        `${interaction.user.username}, tu as choisi **${starterPokemon.name}** niveau ${level} comme starter !\n` +
        `Stats: PV ${stats.hp}, Attaque ${stats.attack}, Défense ${stats.defense}, ` +
        `Attaque Spé ${stats.spAttack}, Défense Spé ${stats.spDefense}, Vitesse ${stats.speed}\n` +
        `Attaques: ${starterPokemon.moves?.map(move => move.name).join(", ") || "Aucune attaque"}`,
      components: [createExploreButton()]
    });
  }
}

// Fonction pour gérer l'exploration de lieux
function handleLocationExploration(interaction: ButtonInteraction): void {
  const userId = interaction.user.id;
  const currentLocation = gameService.getPlayer(userId).location;
  if (!gameService.isLocation(currentLocation)) {
    interaction.reply({ content: "La localisation actuelle est invalide. Veuillez redémarrer l'aventure.", ephemeral: true });
    return;
  }
  const availableRoutes = gameService.getLocation(currentLocation).routes;

  if (availableRoutes.includes(interaction.customId)) {
    gameService.getPlayer(userId).location = interaction.customId;
    const description = gameService.getLocation(interaction.customId).description;
    interaction.reply({
      content: `Tu es maintenant à **${interaction.customId}**. ${description}`,
      components: [createExploreButton()]
    });
  } else {
    interaction.reply({ content: "Ce chemin n'est pas disponible.", ephemeral: true });
  }
}

// Fonction pour gérer les actions dans les lieux
function handleLocationAction(interaction: ButtonInteraction): void {
  const userId = interaction.user.id;
  const currentLocation = gameService.getPlayer(userId).location;
  if (!gameService.isLocation(currentLocation)) {
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
function handleWildPokemonSearch(interaction: ButtonInteraction, currentLocation: string): void {
  const wildPokemons = gameService.getLocation(currentLocation).pokemons;
  if (wildPokemons.length === 0) {
    interaction.reply({ content: "Il n'y a pas de Pokémon sauvages ici.", ephemeral: true });
    return;
  }
  
  const foundPokemon = wildPokemons[Math.floor(Math.random() * wildPokemons.length)];
  const wildPokemonLevel = 5;
  const wildPokemonStats = calculateStats(foundPokemon, wildPokemonLevel);

  // Récupération des attaques disponibles pour le niveau du Pokémon
  const availableMoves: Move[] = [];
  Object.entries(foundPokemon.learnset).forEach(([level, moves]) => {
    if (parseInt(level) <= wildPokemonLevel) {
      moves.forEach(moveId => {
        const move = pokemonService.getMoveByID(moveId);
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
  
  const playerPokemon = gameService.getPlayer(interaction.user.id).pokemons[0];
  
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

  battleStates[interaction.user.id] = {
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

// Fonction pour calculer le multiplicateur de dégâts
function calculateDamageMultiplier(attackType: string, defenderTypes: string[]): number {
  let multiplier = 1;
  defenderTypes.forEach(defenderType => {
    multiplier *= typeChart[attackType][defenderType];
  });
  return multiplier;
}

// Fonction pour obtenir les émojis de type d'un Pokémon
function getTypeEmojis(pokemon: Pokemon): string {
  return pokemon.types.map(type => TYPE_EMOJIS[type] || "❓").join(" ");
}

// Fonction pour gérer les combats
async function handleBattle(interaction: ButtonInteraction): Promise<void> {
  const battleState = battleStates[interaction.user.id];
  if (!battleState) {
    interaction.reply({ content: "Aucun combat en cours.", ephemeral: true });
    return;
  }

  const playerPokemon = battleState.playerPokemon;
  const wildPokemon = battleState.wildPokemon;

  // Sauvegarder les statistiques initiales si elles n'existent pas encore
  if (!battleState.initialPlayerStats && playerPokemon.stats) {
    battleState.initialPlayerStats = { ...playerPokemon.stats };
  }
  if (!battleState.initialWildStats && wildPokemon.stats) {
    battleState.initialWildStats = { ...wildPokemon.stats };
  }

  const playerMaxHP = playerPokemon.stats?.hp || 0;
  const wildMaxHP = wildPokemon.stats?.hp || 0;

  // Créer l'image de combat
  const battleImage = await battleService.createBattleImage(battleState);
  
  // Créer l'attachment pour Discord
  const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

  const battleEmbed = {
    color: 0x0099FF,
    title: '⚔️ Combat Pokémon',
    description: '\u200b',
    fields: [
      {
        name: `${getTypeEmojis(playerPokemon)} ${playerPokemon.name} Nv.${playerPokemon.level}`,
        value: `${battleService.createHPBar(playerPokemon.currentHp || 0, playerMaxHP)}`,
        inline: true
      },
      {
        name: '\u200b',
        value: 'VS',
        inline: true
      },
      {
        name: `${getTypeEmojis(wildPokemon)} ${wildPokemon.name} Nv.${wildPokemon.level}`,
        value: `${battleService.createHPBar(wildPokemon.currentHp || 0, wildMaxHP)}`,
        inline: true
      }
    ],
    image: {
      url: 'attachment://battle.png'
    }
  };

  const row = new ActionRowBuilder<ButtonBuilder>();

  if (playerPokemon.moves && Array.isArray(playerPokemon.moves)) {
    playerPokemon.moves.forEach(move => {
      if (move && move.name) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`attack_${move.name.toLowerCase().replace(/\s+/g, '_')}`)
            .setLabel(`${move.name} (${move.currentPP}/${move.pp})`)
            .setStyle(ButtonStyle.Primary)
        );
      }
    });
  }

  // Ajouter un bouton pour les statistiques
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('battle_stats')
      .setLabel('Statistiques')
      .setStyle(ButtonStyle.Secondary)
  );
  
  // Ajouter un bouton pour fuir
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('flee')
      .setLabel('Fuir')
      .setStyle(ButtonStyle.Danger)
  );

  interaction.reply({
    embeds: [battleEmbed],
    files: [attachment],
    content: `Que doit faire **${battleState.playerPokemon.name}** ?`,
    components: [row]
  });
}

// Fonction pour gérer les attaques
async function handleAttack(interaction: ButtonInteraction, moveName: string): Promise<void> {
  const battleState = battleStates[interaction.user.id];
  if (!battleState) {
    interaction.reply({ content: "Aucun combat en cours.", ephemeral: true });
    return;
  }

  const playerMove = battleState.playerPokemon.moves?.find(m => m.name.toLowerCase() === moveName.toLowerCase());
  if (!playerMove || playerMove.currentPP === undefined || playerMove.currentPP <= 0) {
    interaction.reply({ content: "Cette attaque ne peut pas être utilisée !", ephemeral: true });
    return;
  }

  // Sélection de l'attaque du Pokémon sauvage
  const wildMoves = battleState.wildPokemon.moves || [];
  const wildMove = wildMoves[Math.floor(Math.random() * wildMoves.length)];

  let battleMessage = "";
  const playerSpeed = battleState.playerPokemon.stats?.speed || 0;
  const wildSpeed = battleState.wildPokemon.stats?.speed || 0;

  // Détermine qui attaque en premier en fonction de la vitesse
  const firstAttacker = playerSpeed >= wildSpeed ? 
    { pokemon: battleState.playerPokemon, opponent: battleState.wildPokemon, move: playerMove, isPlayer: true } : 
    { pokemon: battleState.wildPokemon, opponent: battleState.playerPokemon, move: wildMove, isPlayer: false };
  
  const secondAttacker = firstAttacker.isPlayer ? 
    { pokemon: battleState.wildPokemon, opponent: battleState.playerPokemon, move: wildMove, isPlayer: false } : 
    { pokemon: battleState.playerPokemon, opponent: battleState.wildPokemon, move: playerMove, isPlayer: true };

  // Vérifier si les Pokémon peuvent attaquer en fonction de leur statut
  let firstCanAttack = true;
  let secondCanAttack = true;
  
  // Vérifier si le premier attaquant est paralysé (25% de chance de ne pas attaquer)
  if ((firstAttacker.isPlayer && battleState.playerStatus?.type === "paralysis") ||
      (!firstAttacker.isPlayer && battleState.wildStatus?.type === "paralysis")) {
    if (Math.random() < 0.25) {
      firstCanAttack = false;
      battleMessage += `**${firstAttacker.pokemon.name}** est paralysé et ne peut pas attaquer !\n`;
    }
  }
  
  // Vérifier si le premier attaquant est gelé (pas d'attaque) avec 20% de chance de dégel
  if ((firstAttacker.isPlayer && battleState.playerStatus?.type === "freeze") ||
      (!firstAttacker.isPlayer && battleState.wildStatus?.type === "freeze")) {
    if (Math.random() < 0.2) {
      // Dégel
      if (firstAttacker.isPlayer) {
        battleState.playerStatus = undefined;
        battleMessage += `**${firstAttacker.pokemon.name}** n'est plus gelé !\n`;
        firstCanAttack = true;
      } else {
        battleState.wildStatus = undefined;
        battleMessage += `**${firstAttacker.pokemon.name}** n'est plus gelé !\n`;
        firstCanAttack = true;
      }
    } else {
      firstCanAttack = false;
      battleMessage += `**${firstAttacker.pokemon.name}** est gelé et ne peut pas attaquer !\n`;
    }
  }
  
  // Vérifier si le premier attaquant est endormi
  if ((firstAttacker.isPlayer && battleState.playerStatus?.type === "sleep") ||
      (!firstAttacker.isPlayer && battleState.wildStatus?.type === "sleep")) {
    firstCanAttack = false;
    battleMessage += `**${firstAttacker.pokemon.name}** est endormi et ne peut pas attaquer !\n`;
  }

  // Première attaque
  if (firstCanAttack) {
    if (firstAttacker.isPlayer && playerMove.currentPP) playerMove.currentPP--;
    const firstDamage = calculateDamage(firstAttacker.pokemon, firstAttacker.opponent, firstAttacker.move);
    if (firstAttacker.opponent.currentHp !== undefined) {
      firstAttacker.opponent.currentHp = Math.max(0, firstAttacker.opponent.currentHp - firstDamage);
    }
    
    battleMessage += `**${firstAttacker.pokemon.name}** utilise ${firstAttacker.move.name} et inflige ${firstDamage} dégâts à **${firstAttacker.opponent.name}** !`;
    
    // Appliquer les effets de l'attaque
    if (firstAttacker.move.effect) {
      const effectMessage = applyMoveEffect(
        { pokemon: firstAttacker.pokemon, isPlayer: firstAttacker.isPlayer },
        { pokemon: firstAttacker.opponent, isPlayer: !firstAttacker.isPlayer },
        firstAttacker.move,
        battleState
      );
      battleMessage += effectMessage;
    }
  }

  // Vérifie si le combat est terminé après la première attaque
  if (firstAttacker.opponent.currentHp === 0) {
    delete battleStates[interaction.user.id];
    const defeatMessage = firstAttacker.isPlayer ? 
      `\nLe ${firstAttacker.opponent.name} sauvage est K.O. !` : 
      `\nTon ${firstAttacker.opponent.name} est K.O. !`;
    
    // Créer l'image de combat
    const battleImage = await battleService.createBattleImage(battleState);
    const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });
    
    interaction.reply({
      embeds: [createBattleEmbed(battleState, battleMessage + defeatMessage)],
      files: [attachment],
      components: [createExploreButton()]
    });
    return;
  }

  // Vérifier si le second attaquant est paralysé
  if ((secondAttacker.isPlayer && battleState.playerStatus?.type === "paralysis") ||
      (!secondAttacker.isPlayer && battleState.wildStatus?.type === "paralysis")) {
    if (Math.random() < 0.25) {
      secondCanAttack = false;
      battleMessage += `\n**${secondAttacker.pokemon.name}** est paralysé et ne peut pas attaquer !`;
    }
  }
  
  // Vérifier si le second attaquant est gelé
  if ((secondAttacker.isPlayer && battleState.playerStatus?.type === "freeze") ||
      (!secondAttacker.isPlayer && battleState.wildStatus?.type === "freeze")) {
    if (Math.random() < 0.2) {
      // Dégel
      if (secondAttacker.isPlayer) {
        battleState.playerStatus = undefined;
        battleMessage += `\n**${secondAttacker.pokemon.name}** n'est plus gelé !`;
        secondCanAttack = true;
      } else {
        battleState.wildStatus = undefined;
        battleMessage += `\n**${secondAttacker.pokemon.name}** n'est plus gelé !`;
        secondCanAttack = true;
      }
    } else {
      secondCanAttack = false;
      battleMessage += `\n**${secondAttacker.pokemon.name}** est gelé et ne peut pas attaquer !`;
    }
  }
  
  // Vérifier si le second attaquant est endormi
  if ((secondAttacker.isPlayer && battleState.playerStatus?.type === "sleep") ||
      (!secondAttacker.isPlayer && battleState.wildStatus?.type === "sleep")) {
    secondCanAttack = false;
    battleMessage += `\n**${secondAttacker.pokemon.name}** est endormi et ne peut pas attaquer !`;
  }
  
  // Vérifier l'effet flinch (peur) si la première attaque a touché
  if (firstCanAttack && firstAttacker.move.effect?.type === "flinch" && 
      Math.random() * 100 <= (firstAttacker.move.effect.chance || 0)) {
    secondCanAttack = false;
    battleMessage += `\n**${secondAttacker.pokemon.name}** a peur et ne peut pas attaquer !`;
  }

  // Deuxième attaque
  if (secondCanAttack) {
    if (secondAttacker.isPlayer && playerMove.currentPP) playerMove.currentPP--;
    const secondDamage = calculateDamage(secondAttacker.pokemon, secondAttacker.opponent, secondAttacker.move);
    if (secondAttacker.opponent.currentHp !== undefined) {
      secondAttacker.opponent.currentHp = Math.max(0, secondAttacker.opponent.currentHp - secondDamage);
    }
    
    battleMessage += `\n**${secondAttacker.pokemon.name}** utilise ${secondAttacker.move.name} et inflige ${secondDamage} dégâts à **${secondAttacker.opponent.name}** !`;
    
    // Appliquer les effets de l'attaque
    if (secondAttacker.move.effect) {
      const effectMessage = applyMoveEffect(
        { pokemon: secondAttacker.pokemon, isPlayer: secondAttacker.isPlayer },
        { pokemon: secondAttacker.opponent, isPlayer: !secondAttacker.isPlayer },
        secondAttacker.move,
        battleState
      );
      battleMessage += effectMessage;
    }
  }

  // Appliquer les dégâts des statuts (brûlure, poison, etc.)
  const statusEffectsMessage = applyStatusEffects(battleState);
  battleMessage += statusEffectsMessage;

  // Vérifie si le combat est terminé après la seconde attaque ou les effets de statut
  if (battleState.playerPokemon.currentHp === 0 || battleState.wildPokemon.currentHp === 0) {
    const defeatedPokemon = battleState.playerPokemon.currentHp === 0 ? battleState.playerPokemon : battleState.wildPokemon;
    const isPlayerDefeated = battleState.playerPokemon.currentHp === 0;
    
    delete battleStates[interaction.user.id];
    const defeatMessage = isPlayerDefeated ? 
      `\nTon ${defeatedPokemon.name} est K.O. !` : 
      `\nLe ${defeatedPokemon.name} sauvage est K.O. !`;
    
    // Créer l'image de combat
    const battleImage = await battleService.createBattleImage(battleState);
    const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });
    
    interaction.reply({
      embeds: [createBattleEmbed(battleState, battleMessage + defeatMessage)],
      files: [attachment],
      components: [createExploreButton()]
    });
    return;
  }

  // Le combat continue
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (battleState.playerPokemon.moves) {
    battleState.playerPokemon.moves.forEach(move => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`attack_${move.name.toLowerCase().replace(/\s+/g, '_')}`)
          .setLabel(`${move.name} (${move.currentPP}/${move.pp})`)
          .setStyle(ButtonStyle.Primary)
      );
    });
  }
  
  // Ajouter un bouton pour les statistiques
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('battle_stats')
      .setLabel('Statistiques')
      .setStyle(ButtonStyle.Secondary)
  );
  
  // Ajouter un bouton pour fuir
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('flee')
      .setLabel('Fuir')
      .setStyle(ButtonStyle.Danger)
  );

  // Créer l'image de combat mise à jour
  const battleImage = await battleService.createBattleImage(battleState);
  const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

  interaction.reply({
    embeds: [createBattleEmbed(battleState, battleMessage)],
    files: [attachment],
    content: `Que doit faire **${battleState.playerPokemon.name}** ?`,
    components: [row]
  });
}

// Fonction pour calculer les dégâts
function calculateDamage(attacker: Pokemon, defender: Pokemon, move: Move): number {
  if (move.category === "Statut") return 0;
  
  const attackStat = move.category === "Physique" ? 
    attacker.stats?.attack || 0 : 
    attacker.stats?.spAttack || 0;
  
  const defenseStat = move.category === "Physique" ? 
    defender.stats?.defense || 0 : 
    defender.stats?.spDefense || 0;
  
  const typeMultiplier = calculateDamageMultiplier(move.type, defender.types);
  
  // Formule de dégâts Pokémon
  const baseDamage = Math.floor(
    ((2 * (attacker.level || 1) / 5 + 2) * move.power * attackStat / defenseStat / 50 + 2) * 
    typeMultiplier * 
    (Math.random() * (1 - 0.85) + 0.85)
  );

  return baseDamage;
}

// Fonction pour obtenir le message de statut
function getStatusMessage(effectType: string): string {
  switch(effectType) {
    case "burn": return "brûlé";
    case "freeze": return "gelé";
    case "paralysis": return "paralysé";
    case "sleep": return "endormi";
    case "poison": return "empoisonné";
    default: return "";
  }
}

// Fonction pour fuir le combat
function handleFlee(interaction: ButtonInteraction): void {
  delete battleStates[interaction.user.id];
  interaction.reply({
    content: "Tu as fui le combat !",
    components: [createExploreButton()]
  });
}

// Fonction pour calculer les statistiques d'un Pokémon
function calculateStats(pokemon: Pokemon, level: number): Stats {
  const stats: Stats = {
    hp: 0,
    attack: 0,
    defense: 0,
    spAttack: 0,
    spDefense: 0,
    speed: 0
  };
  
  // Calcul des PV
  stats.hp = Math.floor(((2 * pokemon.baseStats.hp + 31 + Math.floor(252/4)) * level) / 100 + level + 10);
  
  // Calcul des autres stats
  const otherStats: (keyof Stats)[] = ['attack', 'defense', 'spAttack', 'spDefense', 'speed'];
  otherStats.forEach(stat => {
    stats[stat] = Math.floor(((2 * pokemon.baseStats[stat] + 31 + Math.floor(252/4)) * level) / 100 + 5);
  });
  
  return stats;
}

// Fonction pour appliquer les effets des attaques
function applyMoveEffect(attacker: { pokemon: Pokemon, isPlayer: boolean }, defender: { pokemon: Pokemon, isPlayer: boolean }, move: Move, battleState: BattleState): string {
  if (!move.effect || !move.effect.type) return "";
  
  const effectChance = move.effect.chance || 0;
  // Vérifie si l'effet s'applique selon la probabilité
  if (Math.random() * 100 > effectChance) return "";
  
  let effectMessage = "";
  const targetStatusRef = defender.isPlayer ? 'playerStatus' : 'wildStatus';
  
  // Si la cible a déjà un statut, on n'en applique pas un nouveau
  if (battleState[targetStatusRef]) return "";
  
  switch (move.effect.type) {
    case "burn":
      battleState[targetStatusRef] = { type: "burn" };
      effectMessage = `${defender.pokemon.name} est brûlé !`;
      break;
    case "freeze":
      battleState[targetStatusRef] = { type: "freeze" };
      effectMessage = `${defender.pokemon.name} est gelé !`;
      break;
    case "paralysis":
      battleState[targetStatusRef] = { type: "paralysis" };
      effectMessage = `${defender.pokemon.name} est paralysé !`;
      break;
    case "sleep":
      battleState[targetStatusRef] = { type: "sleep", turns: Math.floor(Math.random() * 3) + 1 };
      effectMessage = `${defender.pokemon.name} s'est endormi !`;
      break;
    case "poison":
      battleState[targetStatusRef] = { type: "poison" };
      effectMessage = `${defender.pokemon.name} est empoisonné !`;
      break;
    case "attackDown":
      effectMessage = `L'Attaque de ${defender.pokemon.name} baisse !`;
      if (defender.pokemon.stats) defender.pokemon.stats.attack = Math.max(1, Math.floor(defender.pokemon.stats.attack * 0.67));
      break;
    case "defenseDown":
      effectMessage = `La Défense de ${defender.pokemon.name} baisse !`;
      if (defender.pokemon.stats) defender.pokemon.stats.defense = Math.max(1, Math.floor(defender.pokemon.stats.defense * 0.67));
      break;
    case "spAttackDown":
      effectMessage = `L'Attaque Spé de ${defender.pokemon.name} baisse !`;
      if (defender.pokemon.stats) defender.pokemon.stats.spAttack = Math.max(1, Math.floor(defender.pokemon.stats.spAttack * 0.67));
      break;
    case "spDefDown":
      effectMessage = `La Défense Spé de ${defender.pokemon.name} baisse !`;
      if (defender.pokemon.stats) defender.pokemon.stats.spDefense = Math.max(1, Math.floor(defender.pokemon.stats.spDefense * 0.67));
      break;
    case "speedDown":
      effectMessage = `La Vitesse de ${defender.pokemon.name} baisse !`;
      if (defender.pokemon.stats) defender.pokemon.stats.speed = Math.max(1, Math.floor(defender.pokemon.stats.speed * 0.67));
      break;
    case "accuracyDown":
      effectMessage = `La Précision de ${defender.pokemon.name} baisse !`;
      break;
    case "flinch":
      // L'effet de peur est traité séparément dans handleAttack
      break;
    case "rain":
      effectMessage = `Il commence à pleuvoir !`;
      break;
    case "protect":
      effectMessage = `${attacker.pokemon.name} se protège !`;
      break;
  }
  
  return effectMessage ? `\n${effectMessage}` : "";
}

// Fonction pour appliquer les dégâts des statuts
function applyStatusEffects(battleState: BattleState): string {
  let statusMessage = "";
  
  // Effets sur le Pokémon sauvage
  if (battleState.wildStatus) {
    switch (battleState.wildStatus.type) {
      case "burn":
        const burnDamage = Math.max(1, Math.floor((battleState.wildPokemon.stats?.hp || 100) / 16));
        if (battleState.wildPokemon.currentHp !== undefined) {
          battleState.wildPokemon.currentHp = Math.max(0, battleState.wildPokemon.currentHp - burnDamage);
          statusMessage += `\n${battleState.wildPokemon.name} subit des dégâts de brûlure !`;
        }
        break;
      case "poison":
        const poisonDamage = Math.max(1, Math.floor((battleState.wildPokemon.stats?.hp || 100) / 8));
        if (battleState.wildPokemon.currentHp !== undefined) {
          battleState.wildPokemon.currentHp = Math.max(0, battleState.wildPokemon.currentHp - poisonDamage);
          statusMessage += `\n${battleState.wildPokemon.name} subit des dégâts de poison !`;
        }
        break;
    }
  }
  
  // Effets sur le Pokémon du joueur
  if (battleState.playerStatus) {
    switch (battleState.playerStatus.type) {
      case "burn":
        const burnDamage = Math.max(1, Math.floor((battleState.playerPokemon.stats?.hp || 100) / 16));
        if (battleState.playerPokemon.currentHp !== undefined) {
          battleState.playerPokemon.currentHp = Math.max(0, battleState.playerPokemon.currentHp - burnDamage);
          statusMessage += `\n${battleState.playerPokemon.name} subit des dégâts de brûlure !`;
        }
        break;
      case "poison":
        const poisonDamage = Math.max(1, Math.floor((battleState.playerPokemon.stats?.hp || 100) / 8));
        if (battleState.playerPokemon.currentHp !== undefined) {
          battleState.playerPokemon.currentHp = Math.max(0, battleState.playerPokemon.currentHp - poisonDamage);
          statusMessage += `\n${battleState.playerPokemon.name} subit des dégâts de poison !`;
        }
        break;
    }
    
    // Décrémenter les tours pour les statuts temporaires
    if (battleState.playerStatus.turns !== undefined) {
      battleState.playerStatus.turns--;
      if (battleState.playerStatus.turns <= 0) {
        statusMessage += `\n${battleState.playerPokemon.name} n'est plus ${getStatusMessage(battleState.playerStatus.type)} !`;
        battleState.playerStatus = undefined;
      }
    }
  }
  
  // Décrémenter les tours pour les statuts temporaires du Pokémon sauvage
  if (battleState.wildStatus && battleState.wildStatus.turns !== undefined) {
    battleState.wildStatus.turns--;
    if (battleState.wildStatus.turns <= 0) {
      statusMessage += `\n${battleState.wildPokemon.name} n'est plus ${getStatusMessage(battleState.wildStatus.type)} !`;
      battleState.wildStatus = undefined;
    }
  }
  
  return statusMessage;
}

// Créer l'embed pour le combat
const createBattleEmbed = (battleState: BattleState, message: string) => {
  const fields: EmbedField[] = [
    {
      name: `${getTypeEmojis(battleState.playerPokemon)} ${battleState.playerPokemon.name} Nv.${battleState.playerPokemon.level}`,
      value: battleService.createHPBar(battleState.playerPokemon.currentHp || 0, battleState.playerPokemon.stats?.hp || 0),
      inline: true
    },
    {
      name: '\u200b',
      value: 'VS',
      inline: true
    },
    {
      name: `${getTypeEmojis(battleState.wildPokemon)} ${battleState.wildPokemon.name} Nv.${battleState.wildPokemon.level}`,
      value: battleService.createHPBar(battleState.wildPokemon.currentHp || 0, battleState.wildPokemon.stats?.hp || 0),
      inline: true
    },
    {
      name: 'Déroulement du combat',
      value: message,
      inline: false
    }
  ];

  return {
    color: 0x0099FF,
    title: '⚔️ Combat Pokémon',
    description: '\u200b',
    fields: fields,
    image: {
      url: 'attachment://battle.png'
    }
  };
};

// Fonction pour calculer l'efficacité d'un type contre un Pokémon
function calculateTypeEffectivenessAgainst(attackType: string, defenderTypes: string[]): number {
  let effectiveness = 1;
  
  for (const defenderType of defenderTypes) {
    const multiplier = typeChart[attackType]?.[defenderType] || 1;
    effectiveness *= multiplier;
  }
  
  return effectiveness;
}

// Fonction pour afficher les statistiques détaillées du combat en cours
async function handleBattleStatsCommand(message: Message, args: string[]): Promise<void> {
  const userId = message.author.id;
  const battleState = battleStates[userId];
  
  if (!battleState) {
    message.reply("Aucun combat n'est en cours actuellement.");
    return;
  }
  
  const playerPokemon = battleState.playerPokemon;
  const wildPokemon = battleState.wildPokemon;
  
  // Helper function to format stat with color indicators for bonuses/penalties
  const formatStat = (currentStat: number, initialStat: number): string => {
    if (currentStat > initialStat) {
      return `${currentStat} (↑ ${initialStat})`;
    } else if (currentStat < initialStat) {
      return `${currentStat} (↓ ${initialStat})`;
    } else {
      return `${currentStat} (= ${initialStat})`;
    }
  };
  
  // Helper function for HP formatting
  const formatHP = (current: number, max: number): string => {
    const ratio = current / max;
    if (ratio < 0.25) {
      return `${current}/${max} [CRITIQUE]`;
    } else if (ratio < 0.5) {
      return `${current}/${max} [FAIBLE]`;
    } else {
      return `${current}/${max}`;
    }
  };
  
  // Helper function to format effectiveness
  const formatEffectiveness = (effectiveness: number): string => {
    if (effectiveness === 0) return "Inefficace";
    if (effectiveness < 1) return `Peu efficace (x${effectiveness})`;
    if (effectiveness > 1) return `Super efficace (x${effectiveness})`;
    return "Efficacité normale";
  };
  
  // Récupérer les moves disponibles du joueur
  const moveTypes = playerPokemon.moves?.map(move => move.type) || [];
  // Éliminer les doublons
  const uniqueMoveTypes = [...new Set(moveTypes)];
  
  // Calculer l'efficacité de chaque type de move contre l'adversaire
  const moveTypeEffectiveness = uniqueMoveTypes.map(type => ({
    type,
    effectiveness: calculateTypeEffectivenessAgainst(type, wildPokemon.types)
  })).sort((a, b) => b.effectiveness - a.effectiveness);
  
  // Création d'un embed avec les statistiques complètes
  const statsEmbed = {
    color: 0x0099FF,
    title: '📊 Statistiques du combat',
    description: `Combat entre **${playerPokemon.name}** (Nv.${playerPokemon.level}) et **${wildPokemon.name}** sauvage (Nv.${wildPokemon.level})`,
    fields: [
      {
        name: `🧠 Statut de ${playerPokemon.name}`,
        value: battleState.playerStatus ? 
          `${getStatusMessage(battleState.playerStatus.type).toUpperCase()}` : 
          "Normal",
        inline: true
      },
      {
        name: `🧠 Statut de ${wildPokemon.name}`,
        value: battleState.wildStatus ? 
          `${getStatusMessage(battleState.wildStatus.type).toUpperCase()}` : 
          "Normal",
        inline: true
      },
      { name: '\u200b', value: '\u200b', inline: false }, // Séparateur
      // Stats du Pokémon du joueur
      {
        name: `📈 Statistiques de ${playerPokemon.name}`,
        value: "```" +
          `PV: ${formatHP(playerPokemon.currentHp || 0, playerPokemon.stats?.hp || 1)}\n` +
          `Attaque: ${formatStat(playerPokemon.stats?.attack || 0, battleState.initialPlayerStats?.attack || playerPokemon.stats?.attack || 0)}\n` +
          `Défense: ${formatStat(playerPokemon.stats?.defense || 0, battleState.initialPlayerStats?.defense || playerPokemon.stats?.defense || 0)}\n` +
          `Att.Spé: ${formatStat(playerPokemon.stats?.spAttack || 0, battleState.initialPlayerStats?.spAttack || playerPokemon.stats?.spAttack || 0)}\n` +
          `Déf.Spé: ${formatStat(playerPokemon.stats?.spDefense || 0, battleState.initialPlayerStats?.spDefense || playerPokemon.stats?.spDefense || 0)}\n` +
          `Vitesse: ${formatStat(playerPokemon.stats?.speed || 0, battleState.initialPlayerStats?.speed || playerPokemon.stats?.speed || 0)}` +
          "```",
        inline: true
      },
      // Stats du Pokémon sauvage
      {
        name: `📉 Statistiques de ${wildPokemon.name}`,
        value: "```" +
          `PV: ${formatHP(wildPokemon.currentHp || 0, wildPokemon.stats?.hp || 1)}\n` +
          `Attaque: ${formatStat(wildPokemon.stats?.attack || 0, battleState.initialWildStats?.attack || wildPokemon.stats?.attack || 0)}\n` +
          `Défense: ${formatStat(wildPokemon.stats?.defense || 0, battleState.initialWildStats?.defense || wildPokemon.stats?.defense || 0)}\n` +
          `Att.Spé: ${formatStat(wildPokemon.stats?.spAttack || 0, battleState.initialWildStats?.spAttack || wildPokemon.stats?.spAttack || 0)}\n` +
          `Déf.Spé: ${formatStat(wildPokemon.stats?.spDefense || 0, battleState.initialWildStats?.spDefense || wildPokemon.stats?.spDefense || 0)}\n` +
          `Vitesse: ${formatStat(wildPokemon.stats?.speed || 0, battleState.initialWildStats?.speed || wildPokemon.stats?.speed || 0)}` +
          "```",
        inline: true
      },
      { name: '\u200b', value: '\u200b', inline: false }, // Séparateur
      // Efficacité des attaques contre l'adversaire
      {
        name: '🎯 Efficacité de vos attaques',
        value: moveTypeEffectiveness.length > 0 ?
          moveTypeEffectiveness.map(item => 
            `**Type ${item.type}**: ${formatEffectiveness(item.effectiveness)}`
          ).join('\n') : 
          "Aucune information d'efficacité disponible",
        inline: false
      },
      // Attaques disponibles du Pokémon du joueur
      {
        name: '⚔️ Attaques disponibles',
        value: playerPokemon.moves?.map(move => 
          `**${move.name}** (${move.currentPP}/${move.pp}) - Type: ${move.type}, ` +
          `Puissance: ${move.power}, Précision: ${move.accuracy}` +
          `${move.effect ? `, Effet: ${move.effect.type} (${move.effect.chance}%)` : ''}`
        ).join('\n') || "Aucune attaque disponible",
        inline: false
      },
      // Faiblesses et résistances du Pokémon adversaire
      {
        name: `🛡️ Faiblesses et résistances de ${wildPokemon.name}`,
        value: wildPokemon.types.map(type => {
          const weaknesses = Object.entries(typeChart[type])
            .filter(([_, value]) => typeof value === 'number' && (value as number) > 1)
            .map(([typeName, value]) => `${typeName} (x${value})`);
          
          const resistances = Object.entries(typeChart[type])
            .filter(([_, value]) => typeof value === 'number' && (value as number) < 1 && (value as number) > 0)
            .map(([typeName, value]) => `${typeName} (x${value})`);
          
          const immunities = Object.entries(typeChart[type])
            .filter(([_, value]) => value === 0)
            .map(([typeName]) => typeName);
          
          return `**Type ${type}**:\n` +
            `Faiblesses: ${weaknesses.length ? weaknesses.join(', ') : 'Aucune'}\n` +
            `Résistances: ${resistances.length ? resistances.join(', ') : 'Aucune'}\n` +
            `Immunités: ${immunities.length ? immunities.join(', ') : 'Aucune'}`;
        }).join('\n\n'),
        inline: false
      }
    ],
    footer: {
      text: `${message.author.username} - ${new Date().toLocaleString('fr-FR')}`
    }
  };
  
  message.reply({ embeds: [statsEmbed] });
}

// Fonction pour gérer l'interaction avec le bouton des statistiques de combat
async function handleBattleStatsInteraction(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const battleState = battleStates[userId];
  
  if (!battleState) {
    interaction.reply({ content: "Aucun combat n'est en cours actuellement.", ephemeral: true });
    return;
  }
  
  const playerPokemon = battleState.playerPokemon;
  const wildPokemon = battleState.wildPokemon;
  
  // Helper function to format stat with color indicators for bonuses/penalties
  const formatStat = (currentStat: number, initialStat: number): string => {
    if (currentStat > initialStat) {
      return `${currentStat} (↑ ${initialStat})`;
    } else if (currentStat < initialStat) {
      return `${currentStat} (↓ ${initialStat})`;
    } else {
      return `${currentStat} (= ${initialStat})`;
    }
  };
  
  // Helper function for HP formatting
  const formatHP = (current: number, max: number): string => {
    const ratio = current / max;
    if (ratio < 0.25) {
      return `${current}/${max} [CRITIQUE]`;
    } else if (ratio < 0.5) {
      return `${current}/${max} [FAIBLE]`;
    } else {
      return `${current}/${max}`;
    }
  };
  
  // Helper function to format effectiveness
  const formatEffectiveness = (effectiveness: number): string => {
    if (effectiveness === 0) return "Inefficace";
    if (effectiveness < 1) return `Peu efficace (x${effectiveness})`;
    if (effectiveness > 1) return `Super efficace (x${effectiveness})`;
    return "Efficacité normale";
  };
  
  // Récupérer les moves disponibles du joueur
  const moveTypes = playerPokemon.moves?.map(move => move.type) || [];
  // Éliminer les doublons
  const uniqueMoveTypes = [...new Set(moveTypes)];
  
  // Calculer l'efficacité de chaque type de move contre l'adversaire
  const moveTypeEffectiveness = uniqueMoveTypes.map(type => ({
    type,
    effectiveness: calculateTypeEffectivenessAgainst(type, wildPokemon.types)
  })).sort((a, b) => b.effectiveness - a.effectiveness);
  
  // Création d'un embed avec les statistiques complètes
  const statsEmbed = {
    color: 0x0099FF,
    title: '📊 Statistiques du combat',
    description: `Combat entre **${playerPokemon.name}** (Nv.${playerPokemon.level}) et **${wildPokemon.name}** sauvage (Nv.${wildPokemon.level})`,
    fields: [
      {
        name: `🧠 Statut de ${playerPokemon.name}`,
        value: battleState.playerStatus ? 
          `${getStatusMessage(battleState.playerStatus.type).toUpperCase()}` : 
          "Normal",
        inline: true
      },
      {
        name: `🧠 Statut de ${wildPokemon.name}`,
        value: battleState.wildStatus ? 
          `${getStatusMessage(battleState.wildStatus.type).toUpperCase()}` : 
          "Normal",
        inline: true
      },
      { name: '\u200b', value: '\u200b', inline: false }, // Séparateur
      // Stats du Pokémon du joueur
      {
        name: `📈 Statistiques de ${playerPokemon.name}`,
        value: "```" +
          `PV: ${formatHP(playerPokemon.currentHp || 0, playerPokemon.stats?.hp || 1)}\n` +
          `Attaque: ${formatStat(playerPokemon.stats?.attack || 0, battleState.initialPlayerStats?.attack || playerPokemon.stats?.attack || 0)}\n` +
          `Défense: ${formatStat(playerPokemon.stats?.defense || 0, battleState.initialPlayerStats?.defense || playerPokemon.stats?.defense || 0)}\n` +
          `Att.Spé: ${formatStat(playerPokemon.stats?.spAttack || 0, battleState.initialPlayerStats?.spAttack || playerPokemon.stats?.spAttack || 0)}\n` +
          `Déf.Spé: ${formatStat(playerPokemon.stats?.spDefense || 0, battleState.initialPlayerStats?.spDefense || playerPokemon.stats?.spDefense || 0)}\n` +
          `Vitesse: ${formatStat(playerPokemon.stats?.speed || 0, battleState.initialPlayerStats?.speed || playerPokemon.stats?.speed || 0)}` +
          "```",
        inline: true
      },
      // Stats du Pokémon sauvage
      {
        name: `📉 Statistiques de ${wildPokemon.name}`,
        value: "```" +
          `PV: ${formatHP(wildPokemon.currentHp || 0, wildPokemon.stats?.hp || 1)}\n` +
          `Attaque: ${formatStat(wildPokemon.stats?.attack || 0, battleState.initialWildStats?.attack || wildPokemon.stats?.attack || 0)}\n` +
          `Défense: ${formatStat(wildPokemon.stats?.defense || 0, battleState.initialWildStats?.defense || wildPokemon.stats?.defense || 0)}\n` +
          `Att.Spé: ${formatStat(wildPokemon.stats?.spAttack || 0, battleState.initialWildStats?.spAttack || wildPokemon.stats?.spAttack || 0)}\n` +
          `Déf.Spé: ${formatStat(wildPokemon.stats?.spDefense || 0, battleState.initialWildStats?.spDefense || wildPokemon.stats?.spDefense || 0)}\n` +
          `Vitesse: ${formatStat(wildPokemon.stats?.speed || 0, battleState.initialWildStats?.speed || wildPokemon.stats?.speed || 0)}` +
          "```",
        inline: true
      },
      { name: '\u200b', value: '\u200b', inline: false }, // Séparateur
      // Efficacité des attaques contre l'adversaire
      {
        name: '🎯 Efficacité de vos attaques',
        value: moveTypeEffectiveness.length > 0 ?
          moveTypeEffectiveness.map(item => 
            `**Type ${item.type}**: ${formatEffectiveness(item.effectiveness)}`
          ).join('\n') : 
          "Aucune information d'efficacité disponible",
        inline: false
      },
      // Attaques disponibles du Pokémon du joueur
      {
        name: '⚔️ Attaques disponibles',
        value: playerPokemon.moves?.map(move => 
          `**${move.name}** (${move.currentPP}/${move.pp}) - Type: ${move.type}, ` +
          `Puissance: ${move.power}, Précision: ${move.accuracy}` +
          `${move.effect ? `, Effet: ${move.effect.type} (${move.effect.chance}%)` : ''}`
        ).join('\n') || "Aucune attaque disponible",
        inline: false
      },
      // Faiblesses et résistances du Pokémon adversaire
      {
        name: `🛡️ Faiblesses et résistances de ${wildPokemon.name}`,
        value: wildPokemon.types.map(type => {
          const weaknesses = Object.entries(typeChart[type])
            .filter(([_, value]) => typeof value === 'number' && (value as number) > 1)
            .map(([typeName, value]) => `${typeName} (x${value})`);
          
          const resistances = Object.entries(typeChart[type])
            .filter(([_, value]) => typeof value === 'number' && (value as number) < 1 && (value as number) > 0)
            .map(([typeName, value]) => `${typeName} (x${value})`);
          
          const immunities = Object.entries(typeChart[type])
            .filter(([_, value]) => value === 0)
            .map(([typeName]) => typeName);
          
          return `**Type ${type}**:\n` +
            `Faiblesses: ${weaknesses.length ? weaknesses.join(', ') : 'Aucune'}\n` +
            `Résistances: ${resistances.length ? resistances.join(', ') : 'Aucune'}\n` +
            `Immunités: ${immunities.length ? immunities.join(', ') : 'Aucune'}`;
        }).join('\n\n'),
        inline: false
      }
    ],
    footer: {
      text: `${interaction.user.username} - ${new Date().toLocaleString('fr-FR')}`
    }
  };
  
  // Créer les boutons pour revenir au combat
  const row = new ActionRowBuilder<ButtonBuilder>();
  
  // Bouton pour revenir au combat
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('return_to_battle')
      .setLabel('Retour au combat')
      .setStyle(ButtonStyle.Secondary)
  );
  
  await interaction.reply({ embeds: [statsEmbed], components: [row], ephemeral: true });
}

// Fonction pour gérer la commande de réinitialisation du jeu
function handleResetGameCommand(message: Message): void {
  const userId = message.author.id;
  
  // Vérifier si le joueur existe
  if (!gameService.isPlayer(userId)) {
    message.reply("Tu n'as pas encore commencé d'aventure. Utilise `pkmn start` pour commencer.");
    return;
  }
  
  // Créer un bouton de confirmation
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel('Confirmer la réinitialisation')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel('Annuler')
        .setStyle(ButtonStyle.Secondary)
    );
  
  message.reply({
    content: "⚠️ **ATTENTION** ⚠️\n\nTu es sur le point de **réinitialiser complètement** ton aventure Pokémon. Toute ta progression sera **perdue définitivement**.\n\n• Tous tes Pokémon seront supprimés\n• Ta localisation sera réinitialisée\n• Tout combat en cours sera annulé\n\nEs-tu vraiment sûr de vouloir recommencer à zéro ?",
    components: [row]
  });
}

// Fonction pour gérer la confirmation de réinitialisation
async function handleConfirmReset(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  
  // Supprimer les données du joueur
  delete players[userId];
  
  // Supprimer tout état de bataille actif
  delete battleStates[userId];
  
  // Sauvegarder les changements
  saveGameData();
  
  // Envoyer un message de confirmation
  await interaction.update({
    content: "🔄 **Réinitialisation terminée !**\n\nTon aventure Pokémon a été complètement réinitialisée. Tu peux commencer une nouvelle aventure en utilisant la commande `pkmn start`.",
    components: []
  });
}

// Fonction pour sauvegarder les données du jeu
function saveGameData(): void {
  // Créer l'objet de données à sauvegarder
  const gameData = {
    players: gameService.getPlayers(),
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

// Fonction pour charger les données du jeu
function loadGameData(): void {
  try {
    const savePath = path.join(__dirname, 'data', 'game_save.json');
    
    // Vérifier si le fichier de sauvegarde existe
    if (fs.existsSync(savePath)) {
      const saveData = JSON.parse(fs.readFileSync(savePath, 'utf8'));
      
      // Restaurer les données des joueurs
      if (saveData.players) {
        Object.assign(players, saveData.players);
        console.log('Données des joueurs chargées avec succès');
      }
      
      // Les états de bataille ne sont pas restaurés car ils nécessitent des objets Canvas
      // et contiennent des références circulaires
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données du jeu:', error);
  }
}

// Ajouter un gestionnaire pour sauvegarder les données avant la fermeture
process.on('SIGINT', () => {
  console.log('Sauvegarde des données avant fermeture...');
  saveGameData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Sauvegarde des données avant fermeture...');
  saveGameData();
  process.exit(0);
});

// Connecter le bot
client.login(process.env.DISCORD_TOKEN); 