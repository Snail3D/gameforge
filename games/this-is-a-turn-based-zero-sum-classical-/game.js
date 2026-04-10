const WIDTH = 720;
const HEIGHT = 720;
const SIDE_LENGTH = 90;
const COLOR_DARK = "#795548";
const COLOR_LIGHT = "#F0D9B5";

// Game State Variables
let boardState = [];
let currentTurn = "White";
let gameStateStatus = "IN_PROGRESS";

// Input State Management
let playerInput = {
    selectedPiece: null,
    potentialMoves: []
};

// Game History/State Tracking Variables (Added for advanced moves)
let gameHistory = [];
let canCastle = {
    White: { kingside: true, queenside: true },
    Black: { kingside: true, queenside: true }
};

/**
 * Defines the structure for a Piece object.
 * @typedef {Object} Piece
 * @property {'P' | 'R' | 'N' | 'B' | 'Q' | 'K'} type - The type of piece ('P', 'R', 'N', 'B', 'Q', 'K').
 * @property {'White' | 'Black'} color - The color of the piece.
 */

/**
 * Defines the structure for coordinates.
 * @typedef {Object} Coords
 * @property {number} r - Row index (0-7).
 * @property {number} c - Column index (0-7).
 */

/**
 * Defines the structure for a Move Result.
 * @typedef {Object} MoveResult
 * @property {boolean} madeMove - True if the board state was modified.
 * @property {boolean} capturedPiece - True if a piece was captured.
 * @property {Object} castlingUpdate - Updates/snapshot of the canCastle structure.
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
    ctx.fillText(`Turn: ${currentTurn} | Status: ${gameStateStatus} | Castling (W): K: ${canCastle.White.kingside} Q: ${canCastle.White.queenside} | (B): K: ${canCastle.Black.kingside} Q: ${canCastle.Black.queenside}`, 20, 30);
}

/**
 * Deep copies the board state safely.
 * @returns {Array<Array<null | Piece>>} A deep copy of the board.
 */
function deepCopyBoard() {
    let newBoard = [];
    for (let r = 0; r < 8; r++) {
        newBoard[r] = [];
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece) {
                // Create a shallow copy of the piece object to prevent mutation issues
                newBoard[r][c] = { type: piece.type, color: piece.color };
            } else {
                newBoard[r][c] = null;
            }
        }
    }
    return newBoard;
}

/**
 * Helper function to execute the core mechanics of moving a piece, handling captures and castling logic.
 * 
 * @param {Coords} startPos - Starting coordinates {r, c}.
 * @param {Coords} endPos - Ending coordinates {r, c}.
 * @param {Piece} movingPiece - The piece being moved.
 * @param {Object} stateContext - Context containing mutable state (board, canCastle, enPassant).
 * @returns {MoveResult} Object detailing state changes.
 */
function executeMove(startPos, endPos, movingPiece, stateContext) {
    const startR = startPos.r;
    const startC = startPos.c;
    const endR = endPos.r;
    const endC = endPos.c;

    // 1. Create a deep copy of the board state to simulate the move without impacting the real state until confirmed.
    let nextBoardState = deepCopyBoard();
    
    // 2. Determine captured piece
    const capturedPiece = boardState[endR][endC];
    const isCapture = !!capturedPiece && capturedPiece.color !== movingPiece.color;

    // 3. Execute Board State Mutation on the SIMULATED next state
    
    // A. Move piece
    nextBoardState[endR][endC] = { type: movingPiece.type, color: movingPiece.color };
    // B. Clear start square
    nextBoardState[startR][startC] = null;

    // 4. Handle Castling Logic & Rights Loss
    let castlingUsedOnMove = false;
    let potentialCastlingUpdates = {
        White: { kingside: canCastle.White.kingside, queenside: canCastle.White.queenside },
        Black: { kingside: canCastle.Black.kingside, queenside: canCastle.Black.queenside }
    };

    if (movingPiece.type === 'K') {
        const color = movingPiece.color;
        const isWhite = color === 'White';
        
        // Kings move always forfeits castling rights
        if (isWhite) {
            potentialCastlingUpdates.White.kingside = false;
            potentialCastlingUpdates.White.queenside = false;
        } else {
            potentialCastlingUpdates.Black.kingside = false;
            potentialCastlingUpdates.Black.queenside = false;
        }
        // In a full engine, you'd also check if the King passed through check.
    }
    
    // Special logic for Castling Move (Requires Rook to also move)
    if (movingPiece.type === 'K' && Math.abs(startR - endR) === 0 && Math.abs(startC - endC) === 2) {
        // If the King moves two squares, this MUST be castling.
        // King move implies the Rook also moves (e.g., White King from (0, 4) to (0, 6) implies White Rook moves from (0, 7) to (0, 5))
        
        if (movingPiece.color === 'White' && startC === 4 && endC === 6 && canCastle.White.kingside) {
            // Kingside Castling: K(e1->g1), R(h1->f1)
            // Target coordinates: (0, 6) for King, (0, 5) for Rook
            // For simplicity of this execution wrapper, we will *assume* the user picked a valid King move,
            // and we force the Rook move update here to complete the state change for demonstration.
            
            // Update the state on the simulated board:
            nextBoardState[endR][endC] = { type: 'K', color: 'White' }; // King moves to g1
            
            // Rook moves (assuming h1 rook at (0, 7)), lands safely at (0, 5)
            // We must locate the rook object before overwriting
            const startRook = 0;
            const startCRook = 7;
            if (boardState[startRook][startCRook] && boardState[startRook][startCRook].type === 'R' && boardState[startRook][startCRook].color === 'White') {
                 nextBoardState[startRook][startCRook] = null; // Clear old Rook spot
                 nextBoardState[0][5] = { type: 'R', color: 'White' }; // Place Rook at f1
            }
            
            potentialCastlingUpdates.White.kingside = false;
            potentialCastlingUpdates.White.queenside = false; // Both rights lost
            castlingUsedOnMove = true;
        } 
        else if (movingPiece.color === 'White' && startC === 4 && endC === 2 && canCastle.White.queenside) {
            // Queenside Castling: K(e1->c1), R(a1->d1)
            // Target coordinates: (0, 2) for King, (0, 3) for Rook
             nextBoardState[endR][endC] = { type: 'K', color: 'White' }; // King moves to c1
             
             const startRook = 0;
             const startCRook = 0;
             if (boardState[startRook][startCRook] && boardState[startRook][startCRook].type === 'R' && boardState[startRook][startCRook].color === 'White') {
                 nextBoardState[startRook][startCRook] = null; // Clear old Rook spot
                 nextBoardState[0][3] = { type: 'R', color: 'White' }; // Place Rook at d1
             }
             
             potentialCastlingUpdates.White.kingside = false;
             potentialCastlingUpdates.White.queenside = false;
             castlingUsedOnMove = true;
        }
    }


    // 5. Apply State Changes to Global State if move is valid (the calling code must use this logic)
    const moveWasApplied = true; // In this context, we assume the caller validates the move path
    
    let castlingSnapshot = {};
    let historyEntry = {
        move: `${movingPiece.color} ${movingPiece.type} from (${startR}, ${startC}) to (${endR}, ${endC})`,
        captured: isCapture,
        castlingUpdated: castlingUsedOnMove
    };

    // Return structures that allow the caller (handleMouseDown) to update the global state
    return { 
        madeMove: moveWasApplied, 
        capturedPiece: isCapture, 
        castlingUpdate: potentialCastlingUpdates,
        history: historyEntry
    };
}


/**
 * Handles mousedown event for mouse input.
 * @param {MouseEvent} event - The click event.
 */
function handleMouseDown(event) {
    const canvas = event.target.id === 'chessCanvas' ? event.target : document.getElementById('chessCanvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const c = Math.floor(x / SIDE_LENGTH);
    const r = Math.floor(y / SIDE_LENGTH);
    
    if (r < 0 || r >= 8 || c < 0 || c >= 8) {
        return;
    }

    const pieceAtTarget = boardState[r][c];
    const currentColor = currentTurn;

    // State 1: Attempting to select a piece
    if (!playerInput.selectedPiece) {
        if (pieceAtTarget && pieceAtTarget.color === currentColor) {
            // 1. Select the piece. Note: We pass a COPY of the piece to avoid reference issues during move calculation.
            playerInput.selectedPiece = { ...pieceAtTarget };
            
            // 2. Calculate potential moves
            calculatePotentialMoves(playerInput.selectedPiece);
            
        } else {
            // Clear selection
            playerInput.selectedPiece = null;
            playerInput.potentialMoves = [];
        }
    } 
    // State 2: Attempting to move
    else if (playerInput.selectedPiece) {
        const targetIsMoveValid = playerInput.potentialMoves.some(move => {
            const moveR = move.r;
            const moveC = move.c;
            return moveR === r && moveC === c;
        });

        if (targetIsMoveValid) {
            // --- VALID MOVE ATTEMPT: EXECUTE MOVE ---
            
            const { r: startR, c: startC } = getCoordsFromPiece(playerInput.selectedPiece);
            
            // Execute the move and capture details using the new state structure
            const moveResult = executeMove(
                { r: startR, c: startC }, 
                { r: r, c: c }, 
                playerInput.selectedPiece, 
                { canCastle: canCastle }
            );

            // 3. Log and Update State
            if (moveResult.madeMove) {
                // Update global castling rights based on the move execution
                Object.keys(moveResult.castlingUpdate).forEach(colorKey => {
                    if (moveResult.castlingUpdate[colorKey]) {
                        canCastle[colorKey].kingside = moveResult.castlingUpdate[colorKey].kingside !== undefined 
                            ? moveResult.castlingUpdate[colorKey].kingside 
                            : canCastle[colorKey].kingside;
                        canCastle[colorKey].queenside = moveResult.castlingUpdate[colorKey].queenside !== undefined 
                            ? moveResult.castlingUpdate[colorKey].queenside 
                            : canCastle[colorKey].queenside;
                    }
                });
                
                // 4. Apply the move to the actual boardState
                if (playerInput.selectedPiece.type === 'K' && (moveResult.castlingUpdate.White?.kingside === false || moveResult.castlingUpdate.White?.queenside === false)) {
                    // If castling happened, the actual move executed was complex (K+R). We must apply the composite move logic.
                    // Since the simulation logic in executeMove handles the K+R update on the *simulated* board, 
                    // we can manually replicate the board state change for guaranteed sync after a castling move.
                    
                    // For simplicity, if castling rights were used, we trust executeMove updated the state correctly IF it was a castling path move.
                } else {
                    // Simple piece move application
                    boardState[r][c] = { type: playerInput.selectedPiece.type, color: playerInput.selectedPiece.color };
                    boardState[startR][startC] = null;
                }

                // 5. Update History and Turn
                gameHistory.push(moveResult.history);
                
                playerInput.selectedPiece = null;
                playerInput.potentialMoves = [];
                currentTurn = currentTurn === "White" ? "Black" : "White";
                
                console.log(`TURN SWITCHED. Game Update: ${moveResult.capturedPiece ? 'Capture' : 'Move/Castle'}`);
                
                // Redraw the game board once per turn/action
                const ctx = canvas.getContext('2d');
                drawGame(ctx);
            }
            
        } else {
            // Clicked a square that is not a potential target, or clicked own piece again
            
            const targetPiece = boardState[r][c];
            const isOwnPieceClicked = targetPiece && targetPiece.color === currentColor;
            const { r: selectedR, c: selectedC } = getCoordsFromPiece(playerInput.selectedPiece);
            const isSamePieceClicked = (r === selectedR && c === selectedC);

            if (isOwnPieceClicked && !isSamePieceClicked) {
                 // New valid selection
                playerInput.selectedPiece = { ...targetPiece };
                calculatePotentialMoves(playerInput.selectedPiece);
            } else {
                // Invalid click or clicked opponent's piece, clear selection
                playerInput.selectedPiece = null;
                playerInput.potentialMoves = [];
            }
            
            // Always redraw after any action that changes selection state
            const ctx = canvas.getContext('2d');
            drawGame(ctx);
        }
    } // End of if (playerInput.selectedPiece)
}

/** 
 * Handles touchstart event for mobile input.
 * @param {TouchEvent} event - The touch event.
 */
function handleTouchStart(event) {
    const canvas = event.target.id === 'chessCanvas' ? event.target : document.getElementById('chessCanvas');
    if (!canvas) return;

    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    const mockEvent = {
        target: canvas,
        clientX: clientX,
        clientY: clientY,
        preventDefault: () => {}
    };

    handleMouseDown(mockEvent);
}


// Event listener to start the game loop/initialization
window.onload = initializeGame;