import { BattleState } from "../models/Battle";
import { Canvas, loadImage } from 'canvas';
import { HP_BAR_LENGTH, POKEMON_SPRITE_URL } from "../utils/Utils";

type NodeCanvasRenderingContext2D = any;

export class BattleService {

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
}
