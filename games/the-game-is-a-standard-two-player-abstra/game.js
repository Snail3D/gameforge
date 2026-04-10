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
    
    // Row 2 to 5 will be empty based on the assumption of a standard setup, 
    // but for compatibility keeping the structure sound.
    
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
 * Based on the setupInitialBoard, Black pieces occupy rows 0, 1. White occupies 6, 7 (and 7 if we consider the setup above).
 * @param {string} pieceSymbol - The piece type ('R', 'P', etc.).
 * @param {number} row - The row index (0-7).
 * @param {number} col - The column index (0-7).
 * @returns {'white' | 'black' | null} The color ownership.
 */
function getPieceColor(pieceSymbol, row, col) {
    if (!pieceSymbol) return null;

    // Explicitly define color based on standard starting ranks, assuming 0 is black's side, 7 is white's side.
    // Black pieces are 'P' in row 1 and major pieces in row 0. White pieces are 'P' in row 6 and major pieces in row 7.
    const pieceType = pieceSymbol.toUpperCase();

    const isMajorPieceRow = (Math.abs(row - 0) <= 1 || Math.abs(row - 7) <= 1);

    if (row === 0 || row === 1) return 'black';
    if (row === 6 || row === 7) return 'white';
    
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
    
    // Set fill color for contrast when drawing the symbol glyph itself
    canvasContext.fillStyle = (color === 'white') ? '#000000' : '#FFFFFF';
    
    canvasContext.fillText(unicodeSymbol, x_center, y_center);
}

/**
 * Draws the checkered pattern for the 64 squares and visual indicators (highlights/moves).
 */
function drawBoard() {
    // 1. Clear the canvas
    canvasContext.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    // 2. Draw background/squares and overlays
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const x_start = col * SQUARE_DIMENSION;
            const y_start = row * SQUARE_DIMENSION;
            
            let highlightColor = null;
            let isHighlighted = false;
            
            // Determine if the square is a possible move destination (Dot indicator)
            const isTargetMove = gameState.possibleMoves.some(move => move.row === row && move.col === col);
            
            if (gameState.selectedSource && gameState.selectedSource.row === row && gameState.selectedSource.col === col) {
                // Source square highlighting
                highlightColor = 'rgba(255, 255, 0, 0.5)'; // Selected Source
                isHighlighted = true;
            } else if (isTargetMove) {
                // Possible move destination (Dot will be drawn on top)
                highlightColor = 'rgba(0, 200, 0, 0.3)'; // Possible move destination background
                isHighlighted = true;
            } 
            
            // Draw the square background first
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

            // Draw the indicator dot if it is a possible move target
            if (isTargetMove) {
                const x_center = col * SQUARE_DIMENSION + SQUARE_DIMENSION / 2;
                const y_center = row * SQUARE_DIMENSION + SQUARE_DIMENSION / 2;
                
                canvasContext.beginPath();
                canvasContext.arc(x_center, y_center, 10, 0, Math.PI * 2);
                canvasContext.fillStyle = 'black'; // Black fill color for indicator
                canvasContext.fill();
            }
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

/**
 * Placeholder function to calculate valid moves for a selected piece.
 * In a full game, this would analyze piece movement rules.
 * Implemented here to calculate and set gameState.possibleMoves for rendering.
 * @param {{row: number, col: number}} source - The source coordinates.
 */
function calculateValidMoves(source) {
    // Reset moves first
    gameState.possibleMoves = [];

    // *** TASK IMPLEMENTATION: Hardcoding 3 dummy moves ***
    // Dummy moves: (r-1, c), (r, c+1), (r+1, c) relative to the source corner for demonstration
    const dummyMoves = [
        {row: Math.max(0, source.row - 1), col: source.col}, 
        {row: source.row, col: Math.min(7, source.col + 1)}, 
        {row: Math.min(7, source.row + 1), col: source.col}
    ];

    // Ensure the dummy moves stay within bounds and are not the source itself (although the logic above prevents this)
    gameState.possibleMoves = dummyMoves.filter(move => 
        move.row !== source.row || move.col !== source.col
    );
    
    console.log("Calculated/Set possible moves:", gameState.possibleMoves);
    
    renderGame();
}


// Event Listener implementation for Mousedown
function handleMouseDown(event) {
    // Calculate board coordinates using event.offsetX/Y which are pixel coordinates relative to the element
    const col = Math.floor(event.offsetX / SQUARE_DIMENSION);
    const row = Math.floor(event.offsetY / SQUARE_DIMENSION);

    if (row < 0 || row >= 8 || col < 0 || col >= 8) {
        return; // Clicked outside the board area
    }

    // 1. If no piece is currently selected (gameState.selectedSource is null)
    if (gameState.selectedSource === null) {
        const pieceCode = gameState.board[row][col];
        const pieceColor = getPieceColor(pieceCode, row, col);

        // Check 2: If there is a piece found AND its color matches the player's current turn color
        if (pieceCode && pieceColor === gameState.currentPlayer) {
            // Select the piece
            gameState.selectedSource = {row: row, col: col};
            // Calculate and display possible moves
            calculateValidMoves(gameState.selectedSource);
        } else {
            // Clicked on an empty square or opponent's piece when nothing was selected
            gameState.selectedSource = null;
            gameState.possibleMoves = [];
            renderGame(); // Re-render to clear any previous highlights
        }
    } else {
        // If a source IS selected, this click implies a move attempt (or deselection if clicking source again)
        
        // Simple click validation for this step: If the user clicks a valid target, we process it.
        const isTargetValid = gameState.possibleMoves.some(move => move.row === row && move.col === col);
        
        if (isTargetValid) {
            // Simulate a move: Clear, move, then re-render
            const source = gameState.selectedSource;
            
            // 1. Update board: Move piece from source to destination
            gameState.board[row][col] = gameState.board[source.row][source.col]; // New piece at destination
            gameState.board[source.row][source.col] = null; // Clear source
            
            // 2. Update state tracking
            gameState.selectedSource = null;
            gameState.possibleMoves = [];
            
            // 3. Switch player (simplistic)
            gameState.currentPlayer = (gameState.currentPlayer === 'w') ? 'b' : 'w';
            
            renderGame();
        } else {
            // Clicked elsewhere, deselect
            gameState.selectedSource = null;
            gameState.possibleMoves = [];
            renderGame();
        }
    }
}

// Event Listener implementation for Mousedown
canvas.addEventListener('mousedown', handleMouseDown);


// Start the game
initializeGame();