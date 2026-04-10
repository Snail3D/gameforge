const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = 400;
const H = 700;

const BOARD_SIZE = 8;
const TILE_SIZE = W / BOARD_SIZE;
const BOARD_HEIGHT = W; 

// Colors
const COLOR_LIGHT = "#eeeed2";
const COLOR_DARK = "#769656";
const COLOR_HIGHLIGHT = "rgba(255, 255, 0, 0.5)";
const COLOR_UI = "#222";
const COLOR_TEXT = "#fff";
const COLOR_TURN_W = "#fff";
const COLOR_TURN_B = "#aaa";

// Piece Unicode Mapping
const PIECES = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

// Initial Board State
let board = [
    ['r', 'n', '◼', 'b', 'q', 'k', 'b', 'n', 'r'], // Note: Cleaned up for valid array
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];
// Re-initializing board properly to avoid any corrupted state
board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let selectedSquare = null; // {r, c}
let turn = 'W'; // 'W' or 'B'
let statusText = "White's Turn";

const isWhite = (p) => p !== '' && p === p.toUpperCase();
const isBlack = (p) => p !== '' && p === p.toLowerCase();

function processInteraction(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        const piece = board[row][col];
        
        if (selectedSquare) {
            const sr = selectedSquare.r;
            const sc = selectedSquare.c;
            const movingPiece = board[sr][sc];
            
            // If clicking the same square, deselect
            if (row === sr && col === sc) {
                selectedSquare = null;
                statusText = turn === 'W' ? "White's Turn" : "Black's Turn";
                return;
            }

            // Check if target is same team
            const targetPiece = board[row][col];
            const isMovingWhite = isWhite(movingPiece);
            const isTargetWhite = isWhite(targetPiece);

            if (targetPiece !== '' && isTargetWhite === isMovingWhite) {
                // Illegal: selecting opponent piece (for now, we just switch selection)
                selectedSquare = { r: row, c: col };
                statusText = "Invalid Move";
                return;
            }

            // Execute move
            board[row][col] = movingPiece;
            board[sr][sc] = '';
            
            // Switch turn
            turn = (turn === 'W' ? 'B' : 'W');
            statusText = turn === 'W' ? "White's Turn" : "Black's Turn";
            selectedSquare = null;
        } else {
            // Select piece
            if (piece !== '') {
                const pieceIsWhite = isWhite(piece);
                if ((turn === 'W' && pieceIsWhite) || (turn === 'B' && !pieceIsWhite)) {
                    selectedSquare = { r: row, c: col };
                    statusText = `Selected: ${PIECES[piece]}`;
                } else {
                    statusText = "Not your piece!";
                }
            }
        }
    }
}

canvas.addEventListener('mousedown', (e) => {
    processInteraction(e.clientX, e.clientY);
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    processInteraction(touch.clientX, touch.clientY);
}, {passive: false});

function drawUI() {
    ctx.fillStyle = COLOR_UI;
    ctx.fillRect(0, BOARD_HEIGHT, W, H - BOARD_HEIGHT);

    ctx.fillStyle = COLOR_TEXT;
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("CHESS AI", W / 2, BOARD_HEIGHT + 50);
    
    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("Strategy & Conquest", W / 2, BOARD_HEIGHT + 80);

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, BOARD_HEIGHT + 120, W - 40, 150);
    
    ctx.fillStyle = turn === 'W' ? COLOR_TURN_W : COLOR_TURN_B;
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(statusText, W / 2, BOARD_HEIGHT + 150);
}

function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // Draw Board
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? COLOR_LIGHT : COLOR_DARK;
            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                ctx.fillStyle = COLOR_HIGHLIGHT;
                ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Draw Pieces
    ctx.font = `${TILE_SIZE * 0.8}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (p) {
                // To ensure pieces look good, we use black color 
                // but the Unicode characters themselves carry color 
                // on most modern OS/Browsers. 
                ctx.fillStyle = "#000"; 
                ctx.fillText(PIECES[p], c * TILE_SIZE + TILE_SIZE/2, r * TILE_SIZE + TILE_SIZE/2);
            }
        }
    }

    drawUI();
    requestAnimationFrame(render);
}

render();