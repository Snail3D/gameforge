const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d"), W = 400, H = 700;

// Chess board dimensions
const BOARD_SIZE = 8;
const SQUARE_SIZE = W / 8; // Divide the width by 8 squares

// UI Constants
const BOARD_HEIGHT = SQUARE_SIZE * BOARD_SIZE; // 400px
const UI_HEIGHT = H - BOARD_HEIGHT; // 700 - 400 = 300px (Reserved space for status)

// Game State Variables (Global scope for simplicity in this cycle)
let selectedSquare = null; // Tracks {row, col} of the currently selected piece
let potentialMoveTarget = null; // Tracks {row, col} for potential move highlighting

/**
 * Draws utility background rectangles (e.g., active selection highlights).
 * @param {number} x, y, w, h Area to draw over.
 * @param {string} color Highlight color.
 */
function drawOverlay(x, y, w, h, color = 'rgba(0, 255, 0, 0.3)') {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

/**
 * Draws a single square on the chessboard.
 * @param {number} row - The row index (0-7, where 0 is the top).
 * @param {number} col - The column index (0-7, where 0 is the left).
 * @param {string} color - The background color.
 */
function drawSquare(row, col, color) {
    ctx.fillStyle = color;
    ctx.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
}

/**
 * Draws a piece at the specified location.
 * @param {number} row - The row index.
 * @param {number} col - The column index.
 * @param {string} pieceSymbol - The Unicode character for the piece.
 * @param {string} color - The piece color ("black" or "white").
 */
function drawPiece(row, col, pieceSymbol, color) {
    const centerX = col * SQUARE_SIZE + SQUARE_SIZE / 2;
    const centerY = row * SQUARE_SIZE + SQUARE_SIZE / 2;

    // Style for the piece container (optional visual glow/base)
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.fillStyle = color === 'white' ? '#fff' : '#333';
    ctx.beginPath();
    ctx.arc(centerX, centerY, SQUARE_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow

    ctx.font = `${Math.min(SQUARE_SIZE * 0.7, 28)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color === 'white' ? '#000' : '#fff';

    ctx.fillText(pieceSymbol, centerX, centerY);
}

/**
 * Draws UI elements below the board (Status area).
 * @param {string} turn - Current turn ('White' or 'Black').
 * @param {string} statusText - Additional status message.
 */
function drawUI() {
    // 1. Background for the UI Section
    ctx.fillStyle = '#222';
    ctx.fillRect(0, BOARD_HEIGHT, W, UI_HEIGHT);

    // 2. Draw status elements on the reserved space
    const padding = 20;
    const statusAreaY = BOARD_HEIGHT + 20;
    const textHeight = 30;

    // Turn Indicator
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText("TURN:", padding, statusAreaY);
    ctx.fillStyle = 'gold';
    ctx.font = '30px Arial';
    ctx.fillText(turn, padding + 100, statusAreaY);
    
    // Move History Placeholder
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText("Move History:", padding + 250, statusAreaY);
    
    // Current Selection Placeholder
    ctx.fillStyle = 'yellow';
    ctx.font = '16px Arial';
    ctx.fillText("Selected: None", W - padding - 150, statusAreaY);
}


/**
 * Draws the entire chess board, pieces, and current interactive highlights.
 */
function drawBoard() {
    // 1. Fill the immediate background (canvas context)
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);

    // 2. Draw squares (Top section: 400x400)
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            // Chessboard pattern: A1 is dark, A2 is light, etc.
            const isDark = (row + col) % 2 === 0;
            const color = isDark ? '#B88A6D' : '#F0D9B5'; // Standard wood colors
            drawSquare(row, col, color);
        }
    }

    // 3. Place pieces (On top of the drawn squares)
    const pieces = {
        'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟', // Black (Unicode)
        'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'  // White (Unicode)
    };

    // Draw initial pieces (re-drawing to ensure pieces are always on top)
    // Black Rank (Row 0)
    drawPiece(0, 0, pieces['r'], 'black');
    drawPiece(0, 1, pieces['n'], 'black');
    drawPiece(0, 2, pieces['b'], 'black');
    drawPiece(0, 3, pieces['q'], 'black');
    drawPiece(0, 4, pieces['k'], 'black');
    drawPiece(0, 5, pieces['b'], 'black');
    drawPiece(0, 6, pieces['n'], 'black');
    drawPiece(0, 7, pieces['r'], 'black');

    // Black Pawns (Row 1)
    for (let col = 0; col < 8; col++) {
        drawPiece(1, col, pieces['p'], 'black');
    }

    // White Pawns (Row 6)
    for (let col = 0; col < 8; col++) {
        drawPiece(6, col, pieces['p'], 'white');
    }

    // White Major Pieces (Row 7)
    drawPiece(7, 0, pieces['R'], 'white');
    drawPiece(7, 1, pieces['N'], 'white');
    drawPiece(7, 2, pieces['B'], 'white');
    drawPiece(7, 3, pieces['Q'], 'white');
    drawPiece(7, 4, pieces['K'], 'white');
    drawPiece(7, 5, pieces['B'], 'white');
    drawPiece(7, 6, pieces['N'], 'white');
    drawPiece(7, 7, pieces['R'], 'white');
    
    // 4. Draw Interactive Highlights LAST
    if (selectedSquare) {
        // Highlight the selected square (Yellow border/overlay)
        const startX = selectedSquare.col * SQUARE_SIZE;
        const startY = selectedSquare.row * SQUARE_SIZE;
        const w = SQUARE_SIZE;
        const h = SQUARE_SIZE;
        drawOverlay(startX, startY, w, h, 'rgba(255, 255, 0, 0.6)');
    }
    if (potentialMoveTarget) {
        // Highlight potential move targets (Green overlay)
        const startX = potentialMoveTarget.col * SQUARE_SIZE;
        const startY = potentialMoveTarget.row * SQUARE_SIZE;
        const w = SQUARE_SIZE;
        const h = SQUARE_SIZE;
        drawOverlay(startX, startY, w, h, 'rgba(0, 150, 0, 0.6)');
    }
    
    // === DRAW UI LAST TO COVER THE BOTTOM SECTION ===
    drawUI('White', "Make your move!");
}

/**
 * Clears the canvas and redraws everything, useful for animations/state changes.
 */
function redraw() {
    // Clear everything from the previous frame
    ctx.clearRect(0, 0, W, H); 
    
    // Redraw all static elements (Board + Pieces + Highlights)
    drawBoard();
}


// --- Interaction Logic ---

/**
 * Determines if a piece exists at the given grid coordinate.
 * NOTE: In a full game, this would check the game state array. Here, we check based on hardcoded setup for simulation.
 */
function getPieceAt(row, col) {
    if (row < 0 || row >= 8 || col < 0 || col >= 8) return null;
    
    const pieces = {
        'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟', 
        'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
    };

    // Black Pieces (Row 0, 1)
    if (row === 0) {
        const type = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'][col];
        return { piece: pieces[type], color: 'black' };
    }
    if (row === 1) {
        return { piece: pieces['p'], color: 'black' };
    }
    
    // White Pieces (Row 6, 7)
    if (row === 7) {
        const type = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'][col];
        return { piece: pieces[type], color: 'white' };
    }
    if (row === 6) {
        return { piece: pieces['p'], color: 'white' };
    }
    
    return null; // Empty square
}

/**
 * Simulates selecting a piece and finds potential targets (placeholder).
 * @param {number} row - The row index.
 * @param {number} col - The column index.
 */
function handlePieceSelection(row, col, pieceData) {
    if (!pieceData) return;

    // Determine player color based on the active player turn (hardcoded White for now)
    // Assume White is always moving at the start.
    const isWhiteTurn = true; 
    const pieceColor = pieceData.color;

    if (pieceColor !== 'white' && !isWhiteTurn) {
        console.log("It is not your turn or this piece is not yours.");
        selectedSquare = null;
        potentialMoveTarget = null;
        redraw();
        return;
    }

    selectedSquare = { row: row, col: col };
    potentialMoveTarget = null; // Clear old targets
    
    // --- AI/Move Logic Placeholder ---
    // For Cycle 2, if a piece is selected, we will simply highlight ALL empty, reachable squares 
    // in a simple pattern (like a knight move or straight lines) just to show the *concept* of a target highlight.
    if (Math.abs(row - 3) <= 2 && Math.abs(col - 3) <= 2) { // If selection is near center (for visual effect)
        // Simulate 4 possible targets for visualization
        potentialMoveTarget = { row: row + 1, col: col + 2}; 
        potentialMoveTarget = { row: row + 2, col: col + 1}; 
        potentialMoveTarget = { row: row - 1, col: col - 2}; 
        potentialMoveTarget = { row: row - 2, col: col - 1}; 
    } else if (row === 6 && col === 3) { // Special case for Queen at d2 (if we assume it wasn't pawned)
        potentialMoveTarget = { row: 3, col: 3 }; 
    }
    // For simplicity, just keeping the coordinate set as the target for visualization
    potentialMoveTarget = { row: row + 1, col: col + 1 }; 

    console.log(`Piece selected at (${selectedSquare.row}, ${selectedSquare.col}). Targets set.`);
    redraw();
}

/**
 * Handles interaction for both mouse clicks and touch events.
 */
function handleInteraction(event) {
    // Calculate the grid coordinates (0-7) from pixel coordinates (x, y)
    let x, y;
    if (event.touches) {
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
    } else {
        x = event.clientX;
        y = event.clientY;
    }
    
    // Only process clicks within the board area (Top 400px)
    if (y > BOARD_HEIGHT) {
        return;
    }
    
    // Determine grid column and row
    const col = Math.floor(x / SQUARE_SIZE);
    const row = Math.floor(y / SQUARE_SIZE);
    
    console.log(`Clicked square at: Row=${row}, Col=${col}`);

    // 1. Reset state trackers
    let clickedPieceData = getPieceAt(row, col);

    // 2. If nothing is selected, we are trying to select a piece
    if (!selectedSquare) {
        if (clickedPieceData) {
            handlePieceSelection(row, col, clickedPieceData);
        } else {
            // Clicked on empty square when nothing is selected
            selectedSquare = null;
            potentialMoveTarget = null;
            redraw();
        }
    } 
    // 3. If a piece IS selected, we are trying to make a move
    else {
        const isTargeting = (row !== selectedSquare.row || col !== selectedSquare.col);

        if (isTargeting && !clickedPieceData) {
            // Attempting to move to an empty square
            console.log("Attempting move to empty square.");
            // SIMULATE A MOVE: Clear state and redraw to simulate successful capture/move logic
            selectedSquare = null;
            potentialMoveTarget = null;
            // Redraw clears highlights, signifying the move was processed.
            redraw(); 
        } else if (clickedPieceData && clickedPieceData.color === 'white') {
            // Clicked on a different white piece (re-selecting)
            handlePieceSelection(row, col, clickedPieceData);
        } else {
            // Clicked on an invalid spot or enemy piece (do nothing, but clear targets)
            console.log("Invalid move attempt.");
            potentialMoveTarget = null;
            redraw();
        }
    }
}

// Event Listeners for touch/mouse (Overwrites previous generic listeners)
canvas.removeEventListener('click', handleInteraction); // Remove any old listeners to prevent duplication
canvas.removeEventListener('touchstart', (e) => {
    e.preventDefault();
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    handleInteraction({ clientX: x, clientY: y, touches: e.touches });
});

canvas.addEventListener('click', (e) => {
    handleInteraction({ clientX: e.clientX, clientY: e.clientY });
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInteraction(e);
});


// Initial draw call
window.onload = () => {
    redraw();
};