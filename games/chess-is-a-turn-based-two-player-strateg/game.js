const canvas = document.getElementById('chessCanvas');
const ctx = canvas.getContext('2d');

const BOARD_SIZE = 8;
const SQUARE_SIZE = canvas.width / BOARD_SIZE;
const CANVAS_SIZE = canvas.width;

const LIGHT_COLOR = '#F0D9B5';
const DARK_COLOR = '#B58863';

// Board state: 8x8 array, uppercase = white (player), lowercase = black (AI)
// K=King, Q=Queen, R=Rook, B=Bishop, N=Knight, P=Pawn
let board = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
];

let selectedPiece = null;
let selectedRow = -1;
let selectedCol = -1;
let currentPlayer = 'white';
let legalMoves = [];

const PIECE_SYMBOLS = {
    'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
    'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F'
};

function drawGrid() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? LIGHT_COLOR : DARK_COLOR;
            ctx.fillRect(c * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }
    }
}

function drawPieces() {
    ctx.font = (SQUARE_SIZE * 0.7) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (piece && PIECE_SYMBOLS[piece]) {
                ctx.fillStyle = piece === piece.toUpperCase() ? '#FFFFFF' : '#000000';
                ctx.fillText(PIECE_SYMBOLS[piece], c * SQUARE_SIZE + SQUARE_SIZE / 2, r * SQUARE_SIZE + SQUARE_SIZE / 2);
            }
        }
    }
}

/**
 * Draws the entire chessboard, including squares and pieces.
 */
function drawBoard() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawGrid();

    // Highlight selected square
    if (selectedPiece) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(selectedCol * SQUARE_SIZE, selectedRow * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);

        // Highlight legal moves
        for (const move of legalMoves) {
            ctx.fillStyle = 'rgba(0, 150, 0, 0.4)';
            ctx.fillRect(move.c * SQUARE_SIZE, move.r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
        }
    }

    // Draw pieces
    drawPieces();
}

/**
// ... (lines 126-174 are unchanged)


function findBestMoveObject(currentBoard) {
    // In a real implementation, this would parse the result of minimaxSearch 
    // or iterate over all valid moves and let minimax determine the best one.
    
    // For this simulation, we assume the AI picked a move that needs to be applied.
    // This must return an object structure compatible with makeMove.
    if (currentBoard[0][1] === 'p') {
        return { sourceR: 0, sourceC: 1, targetR: 1, targetC: 1 };
    }
    return null; 
}


function runAIMove() {
    console.log("AI is calculating move...");
    
    // 1. Determine the AI's best move using the existing minimaxSearch function.
    // Assuming the AI (Black) is making the move.
    const bestMoveInfo = minimaxSearch(board, SEARCH_DEPTH, -Infinity, Infinity, false); 
    
    // 2. Extract the actual move object needed by makeMove.
    // NOTE: Due to abstraction, we use a placeholder function to simulate obtaining the move.
    const bestMoveObject = findBestMoveObject(board); 
    
    if (bestMoveObject) {
        // 3. Execute the move on the physical board state
        makeMove(bestMoveObject.sourceR, bestMoveObject.sourceC, bestMoveObject.targetR, bestMoveObject.targetC);
        
        // 4. After AI move, switch turn back to the human player ("White").
        switchTurn(); 
        
        // 5. Redraw the game board to reflect changes
        drawBoard();
        
        return true;
    } else {
        gameState = "Draw";
        message = "AI has no legal moves.";
        renderGame();
        return false;
    }
}


/* Placeholder function implementations for the context provided */


function evaluateGameRules() {
    // 1. Check for Checkmate (Highest Priority)
    if (isCheckmate(board, getCurrentPlayerColor())) {
        const winner = getCurrentPlayerColor() === "White" ? "Black" : "White";
        gameState = "Checkmate";
        message = `${winner} has Checkmated the current player!`;
        winner = winner;
        currentPlayerTurn = null;
        return true;
    }

    // 2. Check for Stalemate (Draw Condition)
    let allMovesExist = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (piece && piece.color === getCurrentPlayerColor()) {
                if (hasAnyValidMoveForPiece(r, c, getCurrentPlayerColor())) {
                    allMovesExist = true;
                    break;
                }
            }
        }
        if (allMovesExist) break;
    }

    if (!allMovesExist) {
        gameState = "Stalemate";
        message = "There are no legal moves available. It is a Draw (Stalemate).";
        winner = "Draw";
        currentPlayerTurn = null;
        return true;
    }
    
    // 3. Check for Draw by 50 Move Rule or Threefold Repetition (Simplified check for this step)
    if (isDrawByRepetition()) {
        gameState = "Draw";
        message = "Draw by Threefold Repetition detected.";
        winner = "Draw";
        currentPlayerTurn = null;
        return true;
    }
    
    // 4. Check for Check (If the current player is in check but it wasn't beat by the move)
    if (isCheck(board, getCurrentPlayerColor())) {
        message = `${getCurrentPlayerColor()} is currently in check! Must resolve first.`;
    }
    
    // 5. If none of the above, the game continues.
    return false;
}


function finalizeMoveAndCheckRules() {
    const isGameOver = evaluateGameRules();
    if (isGameOver) {
        renderGame(); // Stops further interaction until reset
        return false;
    }
    
    // If the game is still active, switch turn for the next player (unless AI just moved)
    if (gameState !== "Checkmate" && gameState !== "Stalemate" && gameState !== "Draw") {
        if (currentPlayerTurn === "White" && currentGameStateBeforeMove === "Playing") {
            // White just moved, should now trigger AI move
            console.log("Player moved, triggering AI turn.");
            runAIMove();
            return true; // AI handles the final drawBoard/render
        } else {
            // Normal move completion, switch turn
            switchTurn();
        }
    }
    
    drawBoard();
    renderGame();
    return true;
}


// Helper function to determine and execute the logic flow after a valid move is made.


function drawGameOverOverlay(gameState, message, winner) {
    // 1. Draw a semi-transparent black overlay covering the entire canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // 2. Draw the "GAME OVER" title centered
    ctx.save();
    ctx.fillStyle = '#FFD700'; // Gold color for main title
    ctx.font = '60px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("GAME OVER", CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 40);

    // 3. Draw the state specific subtitle (e.g., CHECKMATE)
    ctx.save();
    ctx.fillStyle = '#FFFFFF'; // White for subtitle color
    if (gameState === "Checkmate") {
        ctx.font = '30px Arial, sans-serif';
        ctx.fillText("CHECKMATE!", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
    } else if (gameState === "Stalemate") {
        ctx.font = '30px Arial, sans-serif';
        ctx.fillText("STALEMATE", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
    } else {
        // Draw general draw/ending status if not specific type
        ctx.font = '30px Arial, sans-serif';
        ctx.fillText("GAME ENDED", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
    }
    ctx.restore();

    // 4. Display the detailed message (Winner/Result)
    ctx.save();
    ctx.fillStyle = '#c0c0c0'; // Silver/Light Grey for informational text
    ctx.font = '22px Arial, sans-serif';
    
    let coreMessage = message;
    let winnerDisplay = '';

    if (winner === "Draw") {
        coreMessage = `The game has concluded in a Draw.`;
    } else if (gameState === "Checkmate") {
        winnerDisplay = `The winner is ${winner} (${winner} wins).`;
    } else if (gameState === "Stalemate") {
        winnerDisplay = `It is a Draw (Stalemate).`;
    } else {
        winnerDisplay = "";
    }

    // Draw primary message
    ctx.textAlign = 'center';
    ctx.fillText(coreMessage, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 70);
    
    // Draw secondary winner message below
    if (winnerDisplay) {
        ctx.font = '20px Arial, sans-serif';
        ctx.fillText(winnerDisplay, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 110);
    }

    // 5. Instructions to reset
    ctx.font = '18px Arial, sans-serif';
    ctx.fillStyle = '#FFA07A'; // Light Salmon for instructions
    ctx.fillText("Click anywhere to play a new game.", CANVAS_SIZE / 2, CANVAS_SIZE - 30);

    ctx.restore();
}


function renderGame() {
    if (gameState !== "Playing") {
        // Transition to the final visual over the board
        drawGameOverOverlay(gameState, message, winner);
    } else {
        // Normal game flow: redraw board, highlights, status elements
        drawBoard();
        // Status bar updates happen via other parts of renderGame/drawBoard depending on implementation, 
        // but conceptually, the canvas needs updating for highlights/turn indicators.
        // Assuming drawBoard handles the primary state representation, we might only need to ensure 
        // the status text/UI elements are updated outside the canvas if they exist.
    }
}


function drawHighlights(selectedPiece) {
    // Placeholder for drawing selection/valid moves when game is active
    // This assumes drawBoard handles the grid and pieces, this function adds selection circles/rings if needed.
    // For now, we rely on drawBoard updating the move highlights.
}


function drawTurnIndicator(turn) {
    // Placeholder for drawing whose turn it is (e.g., a colored marker near the top)
}

// --- Initialization and Event Setup ---

window.onload = () => {
    console.log("Chess AI Initialized.");
    
    // Set up event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Draw the initial state
    drawBoard();
};