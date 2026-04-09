const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants definition
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const SQUARE_SIZE = 50;

// Game state variables
let score = 0;

function draw() {
    // Clear the canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw content using defined constants for context
    ctx.fillStyle = 'blue';
    ctx.fillRect(50, 50, 100, 100);
    
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText('Game Initialized', 10, 30);
}

function gameLoop() {
    draw();
    // Request the next frame
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();