import { BattleState } from "../models/Battle";
import { Canvas, loadImage } from 'canvas';
import { HP_BAR_LENGTH, POKEMON_SPRITE_URL } from "../utils/Utils";
import { ButtonStyle } from "discord.js";
import { ButtonBuilder } from "discord.js";
import { ActionRowBuilder } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { ButtonInteraction } from "discord.js";
import { GameService } from "./GameService";
type NodeCanvasRenderingContext2D = any;

export class BattleService {
    public battleStates: Record<string, BattleState> = {};

    // Fonction pour dessiner une croix rouge sur un Pokémon KO
    private drawKOCross(ctx: NodeCanvasRenderingContext2D, x: number, y: number, size: number): void {
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

    // Fonction pour créer l'image de bataille
    public async createBattleImage(battleState: BattleState): Promise<Buffer> {
        const canvas = new Canvas(512, 256);
        const ctx = canvas.getContext('2d');
    
        // Définir un fond noir semi-transparent
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        // Chargement des images
        const playerSprite = await loadImage(
        `${POKEMON_SPRITE_URL}${battleState.playerPokemon.id}.png`
        );
        const wildSprite = await loadImage(
        `${POKEMON_SPRITE_URL}${battleState.wildPokemon.id}.png`
        );
    
        // Position des Pokémon
        const playerX = 64;
        const wildX = 320;
        const y = 48;
        const size = 128;
    
        // Dessiner le Pokémon du joueur à gauche
        ctx.drawImage(playerSprite, playerX, y, size, size);
        if (battleState.playerPokemon.currentHp !== undefined && battleState.playerPokemon.currentHp <= 0) {
            this.drawKOCross(ctx, playerX + size/2, y + size/2, size);
        }
        
        // Dessiner le Pokémon sauvage à droite
        ctx.drawImage(wildSprite, wildX, y, size, size);
        if (battleState.wildPokemon.currentHp !== undefined && battleState.wildPokemon.currentHp <= 0) {
            this.drawKOCross(ctx, wildX + size/2, y + size/2, size);
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

    // Fonction pour créer la barre de vie
    public createHPBar(currentHP: number, maxHP: number): string {
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

    // Fonction pour gérer les combats
    public async handleBattle(interaction: ButtonInteraction): Promise<void> {
        const battleState = this.battleStates[interaction.user.id];
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
        const battleImage = await this.createBattleImage(battleState);

        // Créer l'attachment pour Discord
        const attachment = new AttachmentBuilder(battleImage, { name: 'battle.png' });

        const battleEmbed = {
            color: 0x0099FF,
            title: '⚔️ Combat Pokémon',
            description: '\u200b',
            fields: [
                {
                    name: `${GameService.getTypeEmojis(playerPokemon)} ${playerPokemon.name} Nv.${playerPokemon.level}`,
                    value: `${this.createHPBar(playerPokemon.currentHp || 0, playerMaxHP)}`,
                    inline: true
                },
                {
                    name: '\u200b',
                    value: 'VS',
                    inline: true
                },
                {
                    name: `${GameService.getTypeEmojis(wildPokemon)} ${wildPokemon.name} Nv.${wildPokemon.level}`,
                    value: `${this.createHPBar(wildPokemon.currentHp || 0, wildMaxHP)}`,
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
}
