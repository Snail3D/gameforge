const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function gameLoop() {
    // Clear canvas to black
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    requestAnimationFrame(gameLoop);
}

// Handle window resizing
window.addEventListener('resize', resize);

// Initialize
resize();
gameLoop();