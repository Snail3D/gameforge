const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const width = 1000;

const grid = Array(100).fill().map(() => Array(100).fill(0));

// Manually define a few path nodes for a sample route
for (let i = 10; i < 80; i++) {
    grid[i][20] = 1;
    grid[20][i] = 1;
}
for (let i = 20; i < 50; i++) {
    grid[50][i] = 1;
}

function draw() {
    ctx.clearRect(0, 0, width, 1000);
    
    // Draw background grid lines
    for (let i = 0; i <= 1000; i += 10) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 1000);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1000, i);
        ctx.stroke();
    }

    // Render path tiles from the grid
    for (let x = 0; x < 100; x++) {
        for (let y = 0; y < 100; y++) {
            if (grid[x][y] === 1) {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(x * 10, y * 10, 10, 10);
            }
        }
    }
}

function update() {}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();