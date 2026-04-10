const canvas = document.createElement('canvas');
canvas.id = 'chessCanvas';
document.body.appendChild(canvas);
const canvasContext = canvas.getContext('2d');

const BOARD_SIZE = 800;
const SQUARE_DIMENSION = BOARD_SIZE / 8; // 100 pixels

// Game State Variables (Simplified for this context)
let gameState = {
    board: [], // 8x8 array of piece codes or null (Using Unicode representations temporarily for the new structure)
    currentPlayer: 'w', // 'w' for white, 'b' for black
    selectedSource: null, // {row: r, col: c}
    possibleMoves: []     // [{row: r, col: c}, ...]
};

// Piece Definitions (Using Unicode symbols for rendering as requested)
const PIECES = {
    'R': { symbol: '♖', colorMap: { white: 'black_fallback', black: 'white_fallback' } }, // Rook
    'N': { symbol: '♘', colorMap: { white: 'black_fallback', black: 'white_fallback' } }, // Knight
    'B': { symbol: '♗', colorMap: { white: 'black_fallback', black: 'white_fallback' } }, // Bishop
    'Q': { symbol: '♕', colorMap: { white: 'black_fallback', black: 'white_fallback' } }, // Queen
    'K': { symbol: '♔', colorMap: { white: 'black_fallback', black: 'white_fallback' } }, // King
    'P': { symbol: '♙', colorMap: { white: 'black_fallback', black: 'white_fallback' } }  // Pawn
};

// Function to map internal piece codes (R, N, etc.) to Unicode characters for drawing.
// We will use a simplified mapping since the requirement asks to use specific unicode examples 
// (♔, ♚) which suggests a direct mapping rather than the simple symbol letters used before.
// Given the ambiguity, we will map the piece letter ('R', 'P') to a standard Unicode symbol based on color.
function getUnicodeSymbol(pieceCode, isWhite) {
    const pieceKey = pieceCode.toUpperCase();

    if (!PIECES[pieceKey]) return '';

    // White Pieces (Uppercase letters used for setup in old logic) -> Use standard Unicode White Symbol
    if (isWhite) {
        switch (pieceKey) {
            case 'R': return '♖'; // White Rook
            case 'N': return '♘'; // White Knight
            case 'B': return '♗'; // White Bishop
            case 'Q': return '♕'; // White Queen
            case 'K': return '♔'; // White King
            case 'P': return '♙'; // White Pawn
        }
    } 
    // Black Pieces (Lowercase letters used for setup in old logic) -> Use standard Unicode Black Symbol
    else {
        switch (pieceKey) {
            case 'R': return '♜'; // Black Rook
            case 'N': return '♞'; // Black Knight
            case 'B': return '♝'; // Black Bishop
            case 'Q': return '♛'; // Black Queen
            case 'K': return '♚'; // Black King
            case 'P': return '♟'; // Black Pawn
        }
    }
    return '';
}


// --- State Persistence Functions ---

/**
 * Initializes the game board state with starting positions.
 * Uses 'R', 'N', etc. for piece type, relying on the coordinate setup for color inference 
 * compatible with the original getPieceColor structure.
 */
function setupInitialBoard() {
    // Initialize empty board
    gameState.board = Array(8).fill(0).map(() => Array(8).fill(null));

    // Row 0: Black back rank (Indices 0, 1)
    gameState.board[0][0] = 'R'; gameState.board[0][1] = 'N'; gameState.board[0][2] = 'B'; 
    gameState.board[0][3] = 'Q'; gameState.board[0][4] = 'K'; gameState.board[0][5] = 'B'; 
    gameState.board[0][6] = 'N'; gameState.board[0][7] = 'R';
    // Row 1: Black pawns
    for (let i = 0; i < 8; i++) {
        gameState.board[1][i] = 'P';
    }
    
    // Row 6: White pawns (Using 'P' placeholder if sticking to letter style)
    for (let i = 0; i < 8; i++) {
        gameState.board[6][i] = 'P';
    }
    // Row 7: White back rank
    gameState.board[7][0] = 'R'; gameState.board[7][1] = 'N'; gameState.board[7][2] = 'B'; 
    gameState.board[7][3] = 'Q'; gameState.board[7][4] = 'K'; gameState.board[7][5] = 'B'; 
    gameState.board[7][6] = 'N'; gameState.board[7][7] = 'R';
}

/**
 * Determines the color based on piece ownership. 
 * Based on the setupInitialBoard, Black pieces occupy rows 0, 1. White occupies 6, 7.
 * @param {string} pieceSymbol - The piece type ('R', 'P', etc.).
 * @param {number} row - The row index (0-7).
 * @param {number} col - The column index (0-7).
 * @returns {'white' | 'black' | null} The color ownership.
 */
function getPieceColor(pieceSymbol, row, col) {
    if (!pieceSymbol) return null;

    // If the piece is in the top two ranks (0, 1) based on standard setup
    if (row < 2) {
        return 'black';
    } 
    // If the piece is in the bottom two ranks (6, 7) based on standard setup
    if (row >= 6) {
        return 'white';
    }
    // Default fallback for the center rows (should be empty in setup, but kept for robustness)
    return null;
}


/**
 * Draws a single piece symbol using Unicode characters.
 * @param {string} pieceSymbol - The piece type code (e.g., 'R', 'P').
 * @param {number} row - The row index (0-7).
 * @param {number} col - The column index (0-7).
 * @param {string} color - 'white' or 'black' to determine the drawn color.
 */
function drawPiece(pieceSymbol, row, col, color) {
    const x_center = col * SQUARE_DIMENSION + SQUARE_DIMENSION / 2;
    const y_center = row * SQUARE_DIMENSION + SQUARE_DIMENSION / 2;
    
    // Get the specific Unicode symbol based on color and type
    let unicodeSymbol = getUnicodeSymbol(pieceSymbol, color === 'white');

    if (!unicodeSymbol) return;

    // Draw the text character (Unicode symbol)
    canvasContext.font = '70px Arial';
    canvasContext.textAlign = 'center';
    canvasContext.textBaseline = 'middle';
    
    // Unicode characters usually convey their own color, but to ensure contrast 
    // or to handle potential rendering issues, we set fill color based on piece color. 
    canvasContext.fillStyle = (color === 'white') ? '#000000' : '#FFFFFF';
    
    // Draw coordinates adjusted manually as requested: x_center - 30, y_center + 25 (relative to the provided dimensions)
    // We adjust the offset slightly to keep it centered visually within the 100x100 square.
    canvasContext.fillText(unicodeSymbol, x_center, y_center);
}

/**
 * Draws the checkered pattern for the 64 squares.
 */
function drawBoard() {
    // 1. Clear the canvas
    canvasContext.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    // 2. Draw background/squares
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const x_start = col * SQUARE_DIMENSION;
            const y_start = row * SQUARE_DIMENSION;
            
            let highlightColor = null;
            let isHighlighted = false;
            
            // Check for highlights
            if (gameState.selectedSource && gameState.selectedSource.row === row && gameState.selectedSource.col === col) {
                highlightColor = 'rgba(255, 255, 0, 0.5)'; // Selected
                isHighlighted = true;
            } else if (gameState.possibleMoves.some(move => move.row === row && move.col === col)) {
                highlightColor = 'rgba(0, 200, 0, 0.3)'; // Possible move destination
                isHighlighted = true;
            } 
            
            // Draw the square
            canvasContext.save();
            if (isHighlighted && highlightColor) {
                canvasContext.fillStyle = highlightColor;
                canvasContext.fillRect(x_start, y_start, SQUARE_DIMENSION, SQUARE_DIMENSION);
            } else {
                // Standard square color alternation: (row + col) parity.
                const color = ((row + col) % 2 === 0) ? '#Eeeecc' : '#769d7e';
                canvasContext.fillStyle = color;
                canvasContext.fillRect(x_start, y_start, SQUARE_DIMENSION, SQUARE_DIMENSION);
            }
            canvasContext.restore();
        }
    }
}

/**
 * Draws all pieces currently placed on the board state.
 * Iterates row by row, checking if a piece exists, determining its color, and drawing it.
 */
function renderPieces() {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const pieceCode = gameState.board[row][col];
            if (pieceCode) {
                // Determine color based on current game state logic
                let pieceColor = getPieceColor(pieceCode, row, col); 
                
                if (pieceColor) {
                    // Use the specialized drawPiece function that handles unicode printing
                    drawPiece(pieceCode, row, col, pieceColor);
                }
            }
        }
    }
}

/**
 * Primary function to render the entire game state onto the canvas.
 */
function renderGame() {
    drawBoard();
    renderPieces();
}

/**
 * Sets up the board drawing element and initializes the game state.
 */
function initializeGame() {
    // Set canvas size attributes
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
    
    setupInitialBoard();
    renderGame();
}

// Event Listeners (Placeholder functionality)
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate board coordinates (row, col)
    const col = Math.floor((x / SQUARE_DIMENSION));
    const row = Math.floor((y / SQUARE_DIMENSION));

    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        console.log(`Clicked at (${row}, ${col})`);
        // In a real game, this would handle selection/move attempt
    }
});

// Start the game
initializeGame();