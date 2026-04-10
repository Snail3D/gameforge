const canvas = document.getElementById("gameCanvas");
const ctx2d = canvas.getContext("2d");
const W = 400;
const H = 700;

// Board Configuration
const BOARD_SIZE = 400;
const SQUARE_SIZE = BOARD_SIZE / 8;

// Piece mapping: Uppercase = White, Lowercase = Black
const board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

const unicodePieces = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

// Game State
let selectedSquare = null; // {row, col}
let statusMessage = "Select a piece to move";

function draw() {
    // 1. Clear Background
    ctx2d.fillStyle = "#1a1a1a";
    ctx2d.fillRect(0, 0, W, H);

    // 2. Draw Chessboard
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            // Alternating Square Colors
            ctx2d.fillStyle = (row + col) % 2 === 0 ? "#eeeed2" : "#769656";
            ctx2d.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);

            // Highlight Selected Square (Using a thick border for maximum visibility)
            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                ctx2d.strokeStyle = "#f7ff00"; // Bright Yellow
                ctx2d.lineWidth = 4;
                ctx2d.strokeRect(col * SQUARE_SIZE + 2, row * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4);
                
                // Also add a semi-transparent overlay for extra clarity
                ctx2d.fillStyle = "rgba(247, 255, 0, 0.3)";
                ctx2d.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }

            // Draw Piece
            const piece = board[row][col];
            if (piece) {
                drawPiece(piece, col, row);
            }
        }
    }

    // 3. Draw UI Panel
    const UI_Y = BOARD_SIZE;
    ctx2d.fillStyle = "#2c2c2c";
    ctx2d.fillRect(0, UI_Y, W, H - UI_Y);

    // Divider Line
    ctx2d.strokeStyle = "#444";
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(0, UI_Y);
    ctx2d.lineTo(W, UI_Y);
    ctx2d.stroke();

    // Text Info
    ctx2d.fillStyle = "#ffffff";
    ctx2d.font = "bold 28px Arial";
    ctx2d.textAlign = "center";
    ctx2d.fillText("CHESS AI", W / 2, UI_Y + 50);

    ctx2d.fillStyle = "#aaa";
    ctx2d.font = "18px Arial";
    ctx2d.fillText(statusMessage, W / 2, UI_Y + 100);
}

function drawPiece(piece, col, row) {
    ctx2d.fillStyle = "#000";
    ctx2d.font = `${SQUARE_SIZE * 0.8}px Arial`;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText(
        unicodePieces[piece], 
        col * SQUARE_SIZE + SQUARE_SIZE / 2, 
        row * SQUARE_SIZE + SQUARE_SIZE / 2
    );
}

function handleInteraction(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Check if click is within the board
    if (x >= 0 && x <= BOARD_SIZE && y >= 0 && y <= BOARD_SIZE) {
        const col = Math.floor(x / SQUARE_SIZE);
        const row = Math.floor(y / SQUARE_SIZE);

        if (selectedSquare) {
            // Attempt to move
            if (selectedSquare.row === row && selectedSquare.col === col) {
                // Deselect if clicking same square
                selectedSquare = null;
                statusMessage = "Select a piece to move";
            } else {
                // Execute move
                const pieceToMove = board[selectedSquare.row][selectedSquare.col];
                board[row][col] = pieceToMove;
                board[selectedSquare.row][selectedSquare.col] = '';
                
                selectedSquare = null;
                statusMessage = "Move executed!";
            }
        } else {
            // Try to select a piece
            if (board[row][col] !== '') {
                selectedSquare = { row, col };
                statusMessage = "Piece selected";
            }
        }
        draw();
    }
}

// Event Listeners
canvas.addEventListener('mousedown', handleInteraction);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInteraction(e);
}, { passive: false });

// Initial Render
draw();