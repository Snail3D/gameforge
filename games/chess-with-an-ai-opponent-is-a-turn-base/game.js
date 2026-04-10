const canvas = document.getElementById('chessCanvas');
const context = canvas.getContext('2d');
const SQUARE_SIZE = 90;

const initialBoard = [
    [{ type: "R", color: "Black" }, { type: "N", color: "Black" }, { type: "B", color: "Black" }, { type: "Q", color: "Black" }, { type: "K", color: "Black" }, { type: "B", color: "Black" }, { type: "N", color: "Black" }, { type: "R", color: "Black" }], // Row 0 (Black side)
    [{ type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }],
    [{ type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }],
    [{ type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }],
    [{ type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }],
    [{ type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }],
    [{ type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }, { type: null }],
    [{ type: "P", color: "White" }, { type: "P", color: "White" }, { type: "P", color: "White" }, { type: "P", color: "White" }, { type: "P", color: "White" }, { type: "P", color: "White" }, { type: "P", color: "White" }, { type: "P", color: "White" }]  // Row 7 (White side)
];

function getPieceColor(piece) {
    if (!piece || !piece.color) return null;
    return piece.color;
}

function drawPiece(context, row, col, piece) {
    if (!piece || !piece.type) return;

    let x = col * SQUARE_SIZE;
    let y = row * SQUARE_SIZE;

    let pieceColor = getPieceColor(piece);
    let pieceFillColor;
    
    if (pieceColor === 'Black') {
        pieceFillColor = '#2c3e50'; // Black piece color
    } else if (pieceColor === 'White') {
        pieceFillColor = '#ffffff'; // White piece color
    } else {
        pieceFillColor = '#cccccc'; // Default placeholder color
    }

    // Draw placeholder circle (centered in the square)
    const centerX = x + SQUARE_SIZE / 2;
    const centerY = y + SQUARE_SIZE / 2;
    
    context.fillStyle = pieceFillColor;
    context.beginPath();
    context.arc(centerX + 45, centerY + 45, 35, 0, Math.PI * 2);
    context.fill();
    
    // Draw text (Piece Type)
    context.fillStyle = pieceColor === 'Black' ? 'white' : 'black'; 
    context.font = `${SQUARE_SIZE * 0.6}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(piece.type, centerX, centerY);
}

function drawBoard() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 8; i++) { // i is row
        for (let j = 0; j < 8; j++) { // j is column
            let color = (j + i) % 2 === 0 ? '#F0D9B5' : '#B58863';
            context.fillStyle = color;
            context.fillRect(j * SQUARE_SIZE, i * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }
    }
}

function drawPieces() {
    for (let i = 0; i < 8; i++) { // i is row
        for (let j = 0; j < 8; j++) { // j is column
            let pieceData = initialBoard[i][j];
            drawPiece(context, i, j, pieceData);
        }
    }
}

function renderGame() {
    drawBoard();
    drawPieces();
}

function gameLoop() {
    renderGame();
    requestAnimationFrame(gameLoop);
}

gameLoop();