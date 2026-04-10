const canvas = document.getElementById('chessCanvas');
const context = canvas.getContext('2d');
const SQUARE_SIZE = 90;

function drawBoard() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let color = (row + col) % 2 === 0 ? '#F0D9B5' : '#B58863';
            context.fillStyle = color;
            context.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }
    }
}

function drawPieces() {
    // Simple placeholder for drawing pieces, using basic circles for now
    // Black pieces (Top rows)
    let blackPieces = [
        { type: 'R', row: 0, col: 0 }, { type: 'N', row: 0, col: 1 }, { type: 'B', row: 0, col: 2 }, { type: 'Q', row: 0, col: 3 },
        { type: 'K', row: 0, col: 4 }, { type: 'B', row: 0, col: 5 }, { type: 'N', row: 0, col: 6 }, { type: 'R', row: 0, col: 7 }
    ];
    
    // White pieces (Bottom rows)
    let whitePieces = [
        { type: 'R', row: 7, col: 0 }, { type: 'N', row: 7, col: 1 }, { type: 'B', row: 7, col: 2 }, { type: 'Q', row: 7, col: 3 },
        { type: 'K', row: 7, col: 4 }, { type: 'B', row: 7, col: 5 }, { type: 'N', row: 7, col: 6 }, { type: 'R', row: 7, col: 7 }
    ];

    let allPieces = [...blackPieces, ...whitePieces];

    allPieces.forEach(piece => {
        let x = piece.col * SQUARE_SIZE + SQUARE_SIZE / 2;
        let y = piece.row * SQUARE_SIZE + SQUARE_SIZE / 2;

        let pieceColor = (piece.row / 8) % 2 === 0 ? 'black' : 'white';
        let baseFillColor = getPieceColor(piece.type, pieceColor);

        // Draw circle base
        context.fillStyle = baseFillColor;
        context.beginPath();
        context.arc(x, y, SQUARE_SIZE / 3, 0, Math.PI * 2);
        context.fill();
        
        // Draw text
        context.fillStyle = 'black';
        context.font = `${SQUARE_SIZE * 0.6}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(piece.type, x, y);
    });
}

function getPieceColor(type, pieceColor) {
    if (pieceColor === 'black') {
        return '#333333';
    } else {
        return '#FFFFFF';
    }
}

function gameLoop() {
    drawBoard();
    drawPieces();
    requestAnimationFrame(gameLoop);
}

gameLoop();