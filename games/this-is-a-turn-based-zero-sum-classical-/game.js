const WIDTH = 720;
const HEIGHT = 720;
const SIDE_LENGTH = 90;
const COLOR_DARK = "#795548";
const COLOR_LIGHT = "#F0D9B5";

// Game State Variables
let boardState = [];
let currentTurn = "White";
let gameStateStatus = "IN_PROGRESS";

// Input State Management (Added for selection tracking)
let playerInput = {
    selectedPiece: null, // Stores the piece object selected by the current player
    potentialMoves: []   // Stores coordinates [r, c] where the piece can potentially move
};


/**
 * Defines the structure for a Piece object.
 * @typedef {Object} Piece
 * @property {string} type - The type of piece ('P', 'R', 'N', 'B', 'Q', 'K').
 * @property {'White' | 'Black'} color - The color of the piece.
 */

/**
 * Initializes the 8x8 board state array with null (representing empty squares).
 * @returns {Array<Array<null | Piece>>} The initialized board state.
 */
function initializeBoard() {
    let board = [];
    for (let i = 0; i < 8; i++) {
        board[i] = [];
        for (let j = 0; j < 8; j++) {
            board[i][j] = null;
        }
    }
    return board;
}

/**
 * Creates a standardized piece object.
 * @param {string} type - The piece type.
 * @param {'White' | 'Black'} color - The color.
 * @returns {Piece} A new piece object.
 */
function createPiece(type, color) {
    return { type: type, color: color };
}

/**
 * Creates a piece object and sets it directly onto the specified board location.
 * @param {string} type - The piece type.
 * @param {'White' | 'Black'} color - The color.
 * @param {number} r - The row index (0-7).
 * @param {number} c - The column index (0-7).
 * @returns {Piece} The created piece object.
 */
function createPieceAt(type, color, r, c) {
    const piece = createPiece(type, color);
    boardState[r][c] = piece;
    return piece;
}

/**
 * Initializes the 8x8 board state array and places all 32 starting pieces.
 * Populates the boardState array systematically for all 32 pieces.
 */
function setInitialPieces(board) {
    const ROOK = 'R';
    const KNIGHT = 'N';
    const BISHOP = 'B';
    const QUEEN = 'Q';
    const KING = 'K';
    const PAWN = 'P';

    // The piece arrangement for a rank of 8 pieces
    const pieceOrder = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];

    // White pieces setup: Ranks 1 (index 0) and 2 (index 1)
    // Rank 1 (Back Rank, r=0)
    for (let c = 0; c < 8; c++) {
        createPieceAt(pieceOrder[c], 'White', 0, c);
    }
    // Rank 2 (Pawns, r=1)
    for (let c = 0; c < 8; c++) {
        createPieceAt(PAWN, 'White', 1, c);
    }

    // Black pieces setup: Ranks 8 (index 7) and 7 (index 6)
    // Rank 8 (Back Rank, r=7)
    for (let c = 0; c < 8; c++) {
        createPieceAt(pieceOrder[c], 'Black', 7, c);
    }
    // Rank 7 (Pawns, r=6)
    for (let c = 0; c < 8; c++) {
        createPieceAt(PAWN, 'Black', 6, c);
    }
}

/**
 * Draws the chessboard grid and sets up the initial background.
 * @param {CanvasRenderingContext2D} ctx - The context to draw on.
 */
function drawBoardGrid(ctx) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            // Standard chess coloring: (r+c)%2 = 0 is one color, 1 is the other.
            // Assuming the top-left (0,0) corresponds to a 'dark' square for this implementation.
            const finalColor = ((r + c) % 2 === 0) ? COLOR_DARK : COLOR_LIGHT;
            
            const x = c * SIDE_LENGTH;
            const y = r * SIDE_LENGTH;
            
            ctx.fillStyle = finalColor;
            ctx.fillRect(x, y, SIDE_LENGTH, SIDE_LENGTH);
        }
    }
}

/**
 * Maps piece types to Unicode symbols and determines display color.
 * @param {Piece | null} piece - The piece object or null.
 * @returns {{symbol: string, color: string}} The symbol and its display color.
 */
function getPieceDisplayInfo(piece) {
    if (!piece) return { symbol: '', color: 'transparent' };
    
    let symbol;
    let color;

    if (piece.color === 'White') {
        // White symbols (Uppercase Unicode)
        switch (piece.type) {
            case 'R': symbol = '♖'; break;
            case 'N': symbol = '♘'; break;
            case 'B': symbol = '♗'; break;
            case 'Q': symbol = '♕'; break;
            case 'K': symbol = '♔'; break;
            case 'P': symbol = '♙'; break;
            default: symbol = '?';
        }
        color = '#000'; // Black text color
    } else { // Black
        // Black symbols (Unicode usually renders darker/black)
        switch (piece.type) {
            case 'R': symbol = '♜'; break;
            case 'N': symbol = '♞'; break;
            case 'B': symbol = '♝'; break;
            case 'Q': symbol = '♛'; break;
            case 'K': symbol = '♚'; break;
            case 'P': symbol = '♟'; break;
            default: symbol = '?';
        }
        color = '#FFF'; // White text color (Allows the contrast of the unicode symbol)
    }
    return { symbol, color };
}

/**
 * Draws all pieces currently on the board state.
 * @param {CanvasRenderingContext2D} ctx - The context to draw on.
 */
function drawPieces(ctx) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece) {
                const { symbol, color } = getPieceDisplayInfo(piece);
                
                const x = c * SIDE_LENGTH;
                const y = r * SIDE_LENGTH;
                
                // Use a font size that looks good across the square
                ctx.font = `${SIDE_LENGTH * 0.7}px Arial Unicode MS`; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.fillStyle = color;
                ctx.fillText(symbol, x + SIDE_LENGTH / 2, y + SIDE_LENGTH / 2);
            }
        }
    }
}

/**
 * Draws any visual feedback for selection or potential moves.
 * @param {CanvasRenderingContext2D} ctx - The context to draw on.
 */
function drawSelectionVisuals(ctx) {
    if (!playerInput.selectedPiece) return;

    const { r: startR, c: startC } = getCoordsFromPiece(playerInput.selectedPiece);
    
    // 1. Highlight the selected piece's square
    ctx.fillStyle = 'rgba(100, 100, 100, 0.3)'; // Dim grey overlay
    ctx.fillRect(startC * SIDE_LENGTH, startR * SIDE_LENGTH, SIDE_LENGTH, SIDE_LENGTH);

    // 2. Highlight potential move squares
    for (const move of playerInput.potentialMoves) {
        const { r: endR, c: endC } = move;
        ctx.fillStyle = 'rgba(79, 192, 192, 0.5)'; // Teal highlight for valid moves
        ctx.fillRect(endC * SIDE_LENGTH, endR * SIDE_LENGTH, SIDE_LENGTH, SIDE_LENGTH);
    }
}

/**
 * Main function to draw the entire game state (Board + Pieces).
 * @param {CanvasRenderingContext2D} ctx - The context to draw on.
 */
function drawGame(ctx) {
    // 1. Draw background grid
    drawBoardGrid(ctx);
    
    // 2. Draw all pieces on top of the grid
    drawPieces(ctx);

    // 3. Draw selection/move feedback
    drawSelectionVisuals(ctx);

    // 4. Draw status text
    ctx.font = "24px Arial";
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.textAlign = 'left';
    ctx.fillText(`Turn: ${currentTurn} | Status: ${gameStateStatus}`, 20, 30);
}

/**
 * Initializes the global game state and draws the starting board.
 */
function initializeGame() {
    const canvas = document.getElementById('chessCanvas');
    if (!canvas) {
        console.error("Canvas element with ID 'chessCanvas' not found.");
        return;
    }
    const ctx = canvas.getContext('2d');
    
    // Clear canvas completely before initialization
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Reset state
    boardState = initializeBoard();
    setInitialPieces(boardState);
    currentTurn = "White";
    gameStateStatus = "IN_PROGRESS";
    playerInput.selectedPiece = null;
    playerInput.potentialMoves = [];

    // Draw the initial state
    drawGame(ctx);
    
    console.log("Game Canvas Initialized and Board Drawn.");
    
    // Set up event listener
    canvas.addEventListener('mousedown', handleMouseDown);
}

/** Helper to get coordinates from a known piece object placed on the board.
 * @param {Piece} piece - The piece object.
 * @returns {{r: number, c: number}} The row and column of the piece.
 */
function getCoordsFromPiece(piece) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (boardState[r][c] === piece) {
                return { r: r, c: c };
            }
        }
    }
    return { r: -1, c: -1 }; // Should not happen if piece exists
}

/** Helper to make column indices readable (a, b, c...) */
function toReadableColumn(c) {
    let alpha = '';
    let temp;
    let i = c;
    while (i >= 0) {
        temp = i % 26;
        alpha = String.fromCharCode(97 + temp) + alpha;
        i = Math.floor(i / 26);
    }
    return alpha;
}

/** Helper to make row indices readable (1, 2, 3...) */
function toReadableRow(r) {
    // Row index r=0 (top) corresponds to Rank 8.
    // Row index r=7 (bottom) corresponds to Rank 1.
    // Rank number = 8 - r
    return 8 - r; 
}

/**
 * Executes placeholder logic for move calculation.
 * In a full implementation, this would use move generation rules (PawnMoves, KnightMoves, etc.).
 */
function calculatePotentialMoves(piece) {
    console.log(`Calculating moves for ${piece.color} ${piece.type} at move location.`);
    // Placeholder: For now, we populate it with empty array, as per instructions.
    playerInput.potentialMoves = []; 
}

/**
 * Handles mouse down event to select pieces and calculate moves.
 * @param {MouseEvent} event - The click event.
 */
function handleMouseDown(event) {
    const canvas = event.target.id === 'chessCanvas' ? event.target : document.getElementById('chessCanvas');
    if (!canvas) return;

    // Calculate coordinates relative to the canvas (assuming canvas is the reference point)
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Determine which square was clicked (c, r)
    const c = Math.floor(x / SIDE_LENGTH);
    const r = Math.floor(y / SIDE_LENGTH);
    
    if (r < 0 || r >= 8 || c < 0 || c >= 8) {
        console.log("Clicked outside board boundaries.");
        return;
    }

    const pieceAtTarget = boardState[r][c];
    const currentColor = currentTurn;

    if (playerInput.selectedPiece) {
        // State 2: Trying to move after a selection
        // If we click a potentially valid target square (empty or enemy piece)
        // We would call attemptMove(r, c) here.
        if (playerInput.potentialMoves.length > 0) {
            // Placeholder logic for move attempt
            console.log(`Attempting move towards (${toReadableColumn(c)}, ${toReadableRow(r)})`);
            // Reset input state after attempted move (even if failed)
            playerInput.selectedPiece = null;
            playerInput.potentialMoves = [];
            drawGame(canvas.getContext('2d')); // Re-render to clear selection
        }
    } else {
        // State 1: No piece selected, attempt to select a piece
        if (pieceAtTarget) {
            if (pieceAtTarget.color === currentColor) {
                // 1. Select the piece
                playerInput.selectedPiece = pieceAtTarget;
                
                // 2. Calculate potential moves for the selected piece
                calculatePotentialMoves(pieceAtTarget);
                
                // 3. Re-render to show selection
                drawGame(canvas.getContext('2d')); 
            } else {
                console.log(`Cannot select piece: Color mismatch. Expected ${currentColor}, found ${pieceAtTarget.color}.`);
                playerInput.selectedPiece = null;
                playerInput.potentialMoves = [];
                drawGame(canvas.getContext('2d'));
            }
        } else {
            // Clicked empty square, and nothing selected, do nothing or clear selection
            playerInput.selectedPiece = null;
            playerInput.potentialMoves = [];
            drawGame(canvas.getContext('2d'));
        }
    }
}


// Event listener to start the game loop/initialization
window.onload = initializeGame;