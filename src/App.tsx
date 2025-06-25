import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
  onGround: boolean;
  animFrame: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'cactus' | 'rock' | 'spike' | 'tree' | 'crystal' | 'mushroom';
}

interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  score: number;
  speed: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_HEIGHT = 80;
const GRAVITY = 0.8;
const JUMP_FORCE = -16;
const INITIAL_SPEED = 4;
const SPEED_INCREMENT = 0.002;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const lastObstacleRef = useRef<number>(0);
  const soundEnabledRef = useRef<boolean>(true);
  const groundOffsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    speed: INITIAL_SPEED
  });
  
  const [player, setPlayer] = useState<Player>({
    x: 80,
    y: CANVAS_HEIGHT - GROUND_HEIGHT - 40,
    width: 28,
    height: 40,
    velocityY: 0,
    isJumping: false,
    onGround: true,
    animFrame: 0
  });
  
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio context and sounds
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const createAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'square') => {
    if (!soundEnabled || !soundEnabledRef.current) return;
    
    const audioContext = createAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }, [soundEnabled, createAudioContext]);

  // Pixel art drawing functions
  const drawPixelRect = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), width, height);
  }, []);

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, player: Player) => {
    const x = Math.floor(player.x);
    const y = Math.floor(player.y);
    
    // Running animation frames
    const runFrame = Math.floor(player.animFrame / 6) % 4;
    
    // Shadow
    drawPixelRect(ctx, x + 4, y + 38, 20, 2, 'rgba(0,0,0,0.3)');
    
    // Main body (ninja/warrior style)
    drawPixelRect(ctx, x + 10, y + 12, 8, 20, '#2C3E50'); // Dark blue body
    
    // Head
    drawPixelRect(ctx, x + 8, y + 4, 12, 12, '#F39C12'); // Orange/tan skin
    
    // Helmet/mask
    drawPixelRect(ctx, x + 6, y + 2, 16, 8, '#34495E'); // Dark helmet
    drawPixelRect(ctx, x + 8, y + 4, 12, 4, '#34495E'); // Mask part
    
    // Eye slits
    drawPixelRect(ctx, x + 10, y + 6, 2, 2, '#E74C3C'); // Red glowing eyes
    drawPixelRect(ctx, x + 16, y + 6, 2, 2, '#E74C3C');
    
    // Chest armor
    drawPixelRect(ctx, x + 9, y + 14, 10, 8, '#7F8C8D'); // Gray armor
    drawPixelRect(ctx, x + 11, y + 16, 6, 4, '#95A5A6'); // Lighter armor detail
    
    // Arms
    drawPixelRect(ctx, x + 4, y + 14, 4, 12, '#F39C12'); // Left arm
    drawPixelRect(ctx, x + 20, y + 14, 4, 12, '#F39C12'); // Right arm
    
    // Arm guards
    drawPixelRect(ctx, x + 4, y + 14, 4, 4, '#7F8C8D');
    drawPixelRect(ctx, x + 20, y + 14, 4, 4, '#7F8C8D');
    
    // Legs (animated based on running)
    if (player.onGround) {
      switch (runFrame) {
        case 0:
          drawPixelRect(ctx, x + 10, y + 32, 4, 8, '#2C3E50'); // Left leg
          drawPixelRect(ctx, x + 14, y + 32, 4, 8, '#2C3E50'); // Right leg
          break;
        case 1:
          drawPixelRect(ctx, x + 8, y + 32, 4, 8, '#2C3E50'); // Left leg forward
          drawPixelRect(ctx, x + 16, y + 32, 4, 8, '#2C3E50'); // Right leg back
          break;
        case 2:
          drawPixelRect(ctx, x + 10, y + 32, 4, 8, '#2C3E50');
          drawPixelRect(ctx, x + 14, y + 32, 4, 8, '#2C3E50');
          break;
        case 3:
          drawPixelRect(ctx, x + 12, y + 32, 4, 8, '#2C3E50'); // Left leg back
          drawPixelRect(ctx, x + 12, y + 32, 4, 8, '#2C3E50'); // Right leg forward
          break;
      }
    } else {
      // Jumping pose
      drawPixelRect(ctx, x + 8, y + 32, 4, 8, '#2C3E50');
      drawPixelRect(ctx, x + 16, y + 32, 4, 8, '#2C3E50');
    }
    
    // Boots
    drawPixelRect(ctx, x + 8, y + 36, 6, 4, '#8B4513'); // Left boot
    drawPixelRect(ctx, x + 14, y + 36, 6, 4, '#8B4513'); // Right boot
    
    // Cape/cloak (animated)
    const capeOffset = Math.sin(player.animFrame * 0.2) * 2;
    drawPixelRect(ctx, x + 22, y + 8 + capeOffset, 6, 16, '#E74C3C'); // Red cape
    drawPixelRect(ctx, x + 24, y + 6 + capeOffset, 4, 12, '#C0392B'); // Cape shadow
    
    // Weapon (sword on back)
    drawPixelRect(ctx, x + 2, y + 8, 2, 16, '#BDC3C7'); // Sword blade
    drawPixelRect(ctx, x + 2, y + 6, 2, 4, '#8B4513'); // Sword handle
  }, [drawPixelRect]);

  const drawCactus = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    const x = Math.floor(obstacle.x);
    const y = Math.floor(obstacle.y);
    
    // Main stem
    drawPixelRect(ctx, x + 8, y, 8, obstacle.height, '#2ECC71');
    
    // Left arm
    drawPixelRect(ctx, x + 2, y + 12, 6, 4, '#2ECC71');
    drawPixelRect(ctx, x, y + 8, 4, 8, '#2ECC71');
    
    // Right arm
    drawPixelRect(ctx, x + 16, y + 16, 6, 4, '#2ECC71');
    drawPixelRect(ctx, x + 20, y + 12, 4, 8, '#2ECC71');
    
    // Spikes
    for (let i = 0; i < obstacle.height; i += 8) {
      drawPixelRect(ctx, x + 6, y + i + 2, 2, 2, '#27AE60');
      drawPixelRect(ctx, x + 16, y + i + 4, 2, 2, '#27AE60');
    }
  }, [drawPixelRect]);

  const drawRock = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    const x = Math.floor(obstacle.x);
    const y = Math.floor(obstacle.y);
    
    // Main rock body
    drawPixelRect(ctx, x + 4, y + 8, 16, 16, '#95A5A6');
    drawPixelRect(ctx, x + 2, y + 12, 20, 12, '#95A5A6');
    drawPixelRect(ctx, x + 6, y + 4, 12, 8, '#95A5A6');
    
    // Highlights
    drawPixelRect(ctx, x + 6, y + 6, 4, 4, '#BDC3C7');
    drawPixelRect(ctx, x + 4, y + 14, 6, 4, '#BDC3C7');
    
    // Shadows
    drawPixelRect(ctx, x + 14, y + 10, 6, 14, '#7F8C8D');
    drawPixelRect(ctx, x + 16, y + 20, 4, 4, '#7F8C8D');
  }, [drawPixelRect]);

  const drawSpike = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    const x = Math.floor(obstacle.x);
    const y = Math.floor(obstacle.y);
    
    // Spike triangles
    for (let i = 0; i < obstacle.width; i += 8) {
      // Main spike
      drawPixelRect(ctx, x + i + 2, y + obstacle.height - 4, 4, 4, '#E67E22');
      drawPixelRect(ctx, x + i + 3, y + obstacle.height - 8, 2, 4, '#E67E22');
      drawPixelRect(ctx, x + i + 3.5, y + obstacle.height - 12, 1, 4, '#E67E22');
      
      // Base
      drawPixelRect(ctx, x + i, y + obstacle.height - 2, 8, 2, '#D35400');
    }
  }, [drawPixelRect]);

  const drawTree = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    const x = Math.floor(obstacle.x);
    const y = Math.floor(obstacle.y);
    
    // Tree trunk
    drawPixelRect(ctx, x + 8, y + 20, 8, obstacle.height - 20, '#8B4513');
    drawPixelRect(ctx, x + 10, y + 18, 4, obstacle.height - 18, '#A0522D');
    
    // Tree crown (multiple layers)
    drawPixelRect(ctx, x, y + 8, 24, 16, '#228B22');
    drawPixelRect(ctx, x + 2, y + 4, 20, 12, '#32CD32');
    drawPixelRect(ctx, x + 4, y, 16, 8, '#228B22');
    
    // Leaves details
    drawPixelRect(ctx, x + 6, y + 2, 4, 4, '#90EE90');
    drawPixelRect(ctx, x + 14, y + 6, 4, 4, '#90EE90');
    drawPixelRect(ctx, x + 2, y + 12, 4, 4, '#90EE90');
  }, [drawPixelRect]);

  const drawCrystal = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    const x = Math.floor(obstacle.x);
    const y = Math.floor(obstacle.y);
    
    // Crystal base
    drawPixelRect(ctx, x + 6, y + obstacle.height - 8, 12, 8, '#9B59B6');
    
    // Crystal body
    drawPixelRect(ctx, x + 8, y + 8, 8, obstacle.height - 16, '#8E44AD');
    drawPixelRect(ctx, x + 10, y + 4, 4, obstacle.height - 12, '#AF7AC5');
    
    // Crystal top
    drawPixelRect(ctx, x + 10, y, 4, 8, '#BB8FCE');
    drawPixelRect(ctx, x + 11, y - 2, 2, 4, '#D2B4DE');
    
    // Glow effect
    drawPixelRect(ctx, x + 9, y + 6, 6, 4, '#E8DAEF');
    drawPixelRect(ctx, x + 7, y + 12, 10, 2, 'rgba(155, 89, 182, 0.5)');
  }, [drawPixelRect]);

  const drawMushroom = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    const x = Math.floor(obstacle.x);
    const y = Math.floor(obstacle.y);
    
    // Mushroom stem
    drawPixelRect(ctx, x + 8, y + 16, 8, obstacle.height - 16, '#F5F5DC');
    drawPixelRect(ctx, x + 10, y + 18, 4, obstacle.height - 18, '#FFFACD');
    
    // Mushroom cap
    drawPixelRect(ctx, x + 2, y + 8, 20, 12, '#DC143C');
    drawPixelRect(ctx, x + 4, y + 4, 16, 8, '#FF6347');
    
    // Spots on cap
    drawPixelRect(ctx, x + 6, y + 6, 4, 4, '#FFFFFF');
    drawPixelRect(ctx, x + 14, y + 8, 4, 4, '#FFFFFF');
    drawPixelRect(ctx, x + 10, y + 12, 4, 4, '#FFFFFF');
    
    // Cap underside
    drawPixelRect(ctx, x + 4, y + 16, 16, 4, '#FFE4E1');
  }, [drawPixelRect]);

  const drawGround = useCallback((ctx: CanvasRenderingContext2D, offset: number) => {
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    
    // Ground base
    drawPixelRect(ctx, 0, groundY, CANVAS_WIDTH, GROUND_HEIGHT, '#8B4513');
    
    // Grass layer
    drawPixelRect(ctx, 0, groundY, CANVAS_WIDTH, 8, '#2ECC71');
    
    // Animated ground pattern
    for (let x = -32; x < CANVAS_WIDTH + 32; x += 16) {
      const pixelX = Math.floor(x + offset) % (CANVAS_WIDTH + 32);
      if (pixelX >= -16 && pixelX <= CANVAS_WIDTH) {
        // Grass tufts
        drawPixelRect(ctx, pixelX, groundY - 2, 2, 4, '#27AE60');
        drawPixelRect(ctx, pixelX + 4, groundY - 1, 2, 3, '#27AE60');
        drawPixelRect(ctx, pixelX + 8, groundY - 3, 2, 5, '#27AE60');
        drawPixelRect(ctx, pixelX + 12, groundY - 1, 2, 3, '#27AE60');
        
        // Dirt details
        drawPixelRect(ctx, pixelX + 2, groundY + 12, 2, 2, '#A0522D');
        drawPixelRect(ctx, pixelX + 6, groundY + 16, 2, 2, '#A0522D');
        drawPixelRect(ctx, pixelX + 10, groundY + 20, 2, 2, '#A0522D');
      }
    }
    
    // Underground layers
    for (let y = groundY + 24; y < CANVAS_HEIGHT; y += 8) {
      for (let x = 0; x < CANVAS_WIDTH; x += 16) {
        if (Math.random() > 0.7) {
          drawPixelRect(ctx, x + (Math.floor(offset / 4) % 16), y, 4, 4, '#654321');
        }
      }
    }
  }, [drawPixelRect]);

  const drawClouds = useCallback((ctx: CanvasRenderingContext2D, offset: number) => {
    const cloudPositions = [
      { x: 50, y: 30, size: 1, speed: 0.2 },
      { x: 200, y: 50, size: 1.5, speed: 0.3 },
      { x: 350, y: 25, size: 0.8, speed: 0.25 },
      { x: 500, y: 45, size: 1.2, speed: 0.35 },
      { x: 650, y: 35, size: 1, speed: 0.28 },
      { x: 800, y: 55, size: 0.9, speed: 0.22 }
    ];
    
    cloudPositions.forEach(cloud => {
      const x = Math.floor((cloud.x + offset * cloud.speed) % (CANVAS_WIDTH + 150)) - 75;
      const y = cloud.y;
      const size = cloud.size;
      
      if (x >= -75 && x <= CANVAS_WIDTH) {
        // Pixel cloud with more detail
        drawPixelRect(ctx, x + 4 * size, y + 6 * size, 8 * size, 4 * size, '#FFFFFF');
        drawPixelRect(ctx, x, y + 4 * size, 16 * size, 8 * size, '#FFFFFF');
        drawPixelRect(ctx, x + 8 * size, y, 12 * size, 8 * size, '#FFFFFF');
        drawPixelRect(ctx, x + 16 * size, y + 2 * size, 8 * size, 8 * size, '#FFFFFF');
        drawPixelRect(ctx, x + 20 * size, y + 6 * size, 4 * size, 4 * size, '#FFFFFF');
        
        // Cloud shadows
        drawPixelRect(ctx, x + 2 * size, y + 8 * size, 14 * size, 2 * size, '#F0F8FF');
        drawPixelRect(ctx, x + 10 * size, y + 6 * size, 10 * size, 2 * size, '#F0F8FF');
      }
    });
  }, [drawPixelRect]);

  const jump = useCallback(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;
    
    setPlayer(prev => {
      if (prev.onGround) {
        playSound(400, 0.1, 'square');
        return {
          ...prev,
          velocityY: JUMP_FORCE,
          isJumping: true,
          onGround: false
        };
      }
      return prev;
    });
  }, [gameState.isPlaying, gameState.isGameOver, playSound]);

  const checkCollision = useCallback((player: Player, obstacle: Obstacle): boolean => {
    return player.x + 6 < obstacle.x + obstacle.width &&
           player.x + player.width - 6 > obstacle.x &&
           player.y + 6 < obstacle.y + obstacle.height &&
           player.y + player.height > obstacle.y;
  }, []);

  const generateObstacle = useCallback((): Obstacle => {
    const types: Array<{ type: 'cactus' | 'rock' | 'spike' | 'tree' | 'crystal' | 'mushroom', width: number, height: number }> = [
      { type: 'cactus', width: 24, height: 48 },
      { type: 'rock', width: 24, height: 24 },
      { type: 'spike', width: 32, height: 16 },
      { type: 'tree', width: 24, height: 56 },
      { type: 'crystal', width: 24, height: 40 },
      { type: 'mushroom', width: 24, height: 32 }
    ];
    const obstacleType = types[Math.floor(Math.random() * types.length)];
    
    return {
      x: CANVAS_WIDTH,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - obstacleType.height,
      width: obstacleType.width,
      height: obstacleType.height,
      type: obstacleType.type
    };
  }, []);

  const gameLoop = useCallback(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;

    // Update ground animation
    groundOffsetRef.current -= gameState.speed;
    
    // Update player animation
    animationFrameRef.current += 1;

    setPlayer(prev => {
      let newPlayer = { ...prev };
      
      // Update animation frame
      newPlayer.animFrame = animationFrameRef.current;
      
      // Apply gravity
      newPlayer.velocityY += GRAVITY;
      newPlayer.y += newPlayer.velocityY;
      
      // Ground collision
      const groundY = CANVAS_HEIGHT - GROUND_HEIGHT - newPlayer.height;
      if (newPlayer.y >= groundY) {
        newPlayer.y = groundY;
        newPlayer.velocityY = 0;
        newPlayer.isJumping = false;
        newPlayer.onGround = true;
      } else {
        newPlayer.onGround = false;
      }
      
      return newPlayer;
    });

    setObstacles(prev => {
      let newObstacles = prev.map(obstacle => ({
        ...obstacle,
        x: obstacle.x - gameState.speed
      })).filter(obstacle => obstacle.x + obstacle.width > 0);

      // Generate new obstacles more frequently and consistently
      const now = Date.now();
      const baseInterval = 800; // Base time between obstacles
      const speedMultiplier = Math.max(0.3, 1 - (gameState.speed - INITIAL_SPEED) * 0.1); // Faster = more frequent
      const interval = baseInterval * speedMultiplier + Math.random() * 400; // Add some randomness
      
      if (now - lastObstacleRef.current > interval) {
        newObstacles.push(generateObstacle());
        lastObstacleRef.current = now;
      }

      return newObstacles;
    });

    // Update score and speed
    setGameState(prev => ({
      ...prev,
      score: prev.score + 1,
      speed: Math.min(prev.speed + SPEED_INCREMENT, 12)
    }));

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, gameState.isGameOver, gameState.speed, generateObstacle]);

  // Check collisions
  useEffect(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;

    for (const obstacle of obstacles) {
      if (checkCollision(player, obstacle)) {
        playSound(150, 0.5, 'sawtooth');
        setGameState(prev => ({ ...prev, isGameOver: true }));
        break;
      }
    }
  }, [player, obstacles, gameState.isPlaying, gameState.isGameOver, checkCollision, playSound]);

  // Start game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isGameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.isGameOver, gameLoop]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw sky gradient (pixel art style)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT - GROUND_HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);

    // Draw clouds
    drawClouds(ctx, groundOffsetRef.current);

    // Draw ground
    drawGround(ctx, groundOffsetRef.current);

    // Draw obstacles
    obstacles.forEach(obstacle => {
      switch (obstacle.type) {
        case 'cactus':
          drawCactus(ctx, obstacle);
          break;
        case 'rock':
          drawRock(ctx, obstacle);
          break;
        case 'spike':
          drawSpike(ctx, obstacle);
          break;
        case 'tree':
          drawTree(ctx, obstacle);
          break;
        case 'crystal':
          drawCrystal(ctx, obstacle);
          break;
        case 'mushroom':
          drawMushroom(ctx, obstacle);
          break;
      }
    });

    // Draw player
    drawPlayer(ctx, player);

    // Draw UI with pixel font style
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`SCORE: ${Math.floor(gameState.score / 10)}`, 20, 30);
    
    ctx.font = '14px monospace';
    ctx.fillText(`SPEED: ${gameState.speed.toFixed(1)}X`, 20, 55);
  }, [player, obstacles, gameState.score, gameState.speed, drawPlayer, drawCactus, drawRock, drawSpike, drawTree, drawCrystal, drawMushroom, drawGround, drawClouds]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [jump]);

  const startGame = () => {
    setGameState({
      isPlaying: true,
      isGameOver: false,
      score: 0,
      speed: INITIAL_SPEED
    });
    setPlayer({
      x: 80,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - 40,
      width: 28,
      height: 40,
      velocityY: 0,
      isJumping: false,
      onGround: true,
      animFrame: 0
    });
    setObstacles([]);
    lastObstacleRef.current = Date.now();
    groundOffsetRef.current = 0;
    animationFrameRef.current = 0;
  };

  const toggleSound = () => {
    setSoundEnabled(prev => {
      soundEnabledRef.current = !prev;
      return !prev;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-white mb-2 font-mono tracking-wider" style={{ textShadow: '4px 4px 0px #000' }}>
          PIXEL RUNNER
        </h1>
        <p className="text-cyan-300 font-mono text-lg">Master ninja running through the mystical pixel realm!</p>
      </div>

      <div className="relative bg-gray-900 rounded-lg shadow-2xl p-4 border-4 border-gray-700" style={{ imageRendering: 'pixelated' }}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSound}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded border-2 border-gray-600 transition-colors font-mono"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="text-sm">{soundEnabled ? 'SFX ON' : 'SFX OFF'}</span>
            </button>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {Math.floor(gameState.score / 10)}
            </div>
            <div className="text-sm text-gray-400 font-mono">HIGH SCORE</div>
          </div>
        </div>

        <div className="relative border-4 border-gray-600 rounded">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full max-w-full h-auto cursor-pointer block"
            onClick={jump}
            style={{ 
              aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
              imageRendering: 'pixelated'
            }}
          />
          
          {(!gameState.isPlaying || gameState.isGameOver) && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <div className="text-center text-white">
                {gameState.isGameOver ? (
                  <>
                    <h2 className="text-4xl font-bold mb-2 font-mono text-red-400" style={{ textShadow: '2px 2px 0px #000' }}>
                      GAME OVER!
                    </h2>
                    <p className="text-xl mb-4 font-mono text-cyan-300">FINAL SCORE: {Math.floor(gameState.score / 10)}</p>
                    <button
                      onClick={startGame}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded border-2 border-green-400 font-mono font-bold transition-colors mx-auto"
                    >
                      <RotateCcw size={20} />
                      PLAY AGAIN
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl font-bold mb-4 font-mono text-cyan-400" style={{ textShadow: '2px 2px 0px #000' }}>
                      READY RUNNER?
                    </h2>
                    <button
                      onClick={startGame}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded border-2 border-blue-400 font-mono font-bold transition-colors mx-auto"
                    >
                      <Play size={20} />
                      START RUNNING
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-gray-300">
          <p className="text-sm font-mono">
            Press <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-500 font-mono">SPACE</kbd> or 
            <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-500 font-mono ml-1">↑</kbd> to jump, or click/tap the game
          </p>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-300 text-sm max-w-2xl">
        <p className="font-mono">
          Guide the pixel runner through an enchanted realm filled with mystical obstacles! 
          Avoid cacti, rocks, spikes, ancient trees, magical crystals, and giant mushrooms. 
          The faster you run, the more challenges await!
        </p>
      </div>
    </div>
  );
}

export default App;