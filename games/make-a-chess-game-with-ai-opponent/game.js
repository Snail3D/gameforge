const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function initGame() {
    resetGame();

    const handleInput = (x, y) => {
        if (gameOver || isAiThinking) return;
        const c = Math.floor(x / CELL_SIZE);
        const r = Math.floor(y / CELL_SIZE);
        if (r >= 8 || c >= 8 || r < 0 || c < 0) return;

        const move = validMoves.find(m => m.toR === r && m.toC === c);
        if (move && selectedSquare) {
            executeMove(move);
            selectedSquare = null;
            validMoves = [];
            if (turn === 'B') {
                triggerAiMove();
            }
            return;
        }

        const piece = board[r][c];
        const pieceSide = piece ? (isWhite(piece) ? 'W' : 'B') : null;
        
        if (piece && pieceSide === turn) {
            selectedSquare = {r, c};
            // Use the cleaned version for legal moves
            validMoves = getLegalMovesClean(r, c);
        } else {
            selectedSquare = null;
            validMoves = [];
        }
    };

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        handleInput(x, y);
    });

    canvas.addEventListener('touchstart', (e) => {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
        handleInput(x, y);
        if (e.cancelable) e.preventDefault();
    }, {passive: false});

    canvas.addEventListener('dblclick', resetGame);

    requestAnimationFrame(loop);
}

function executeMove(move) {
    const actualPiece = board[move.fromR][move.fromC];
    const target = board[move.toR][move.toC];

    const notation = `${getColName(move.fromC)}${8-move.fromR} $\\to$ ${getColHTML(move.toC)}${8-move.toR}`;
    // Note: notation string is just for history.
    moveHistory.push(`${getColName(move.fromC)}${8-move.fromR} → ${getColName(move.toC)}${8-move.toR}`);

    if (target) {
        if (isWhite(target)) capturedByW.push(target);
        else if (isBlack(target)) capturedByB.push(target);
    }

    board[move.toR][move.toC] = actualPiece;
    board[move.fromR][move.fromC] = '';
    
    lastMove = move;
    turn = (turn === 'W') ? 'B' : 'W';

    // Check for checkmate/game over
    // If the player whose turn it is has NO legal moves and is in check
    const nextPlayer = turn;
    let hasMoves = false;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const p = board[r][c];
            if(p && (nextPlayer === 'W' ? isWhite(p) : isBlack(p))) {
                if(getLegalMovesClean(r,c).length > 0) {
                    hasMoves = true; 
                    break;
                }
            }
        }
        if(hasMoves) break;
    }

    if (!hasMoves) {
        if (isKingInCheck(nextPlayer)) {
            gameOver = true;
            winMessage = (nextPlayer === 'W' ? "Black Wins!" : "White Wins!");
        }
    }
}

function loop() {
    draw();
    requestAnimationFrame(loop);
}

function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#eeeed2' : '#769656';
            ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    if (lastMove) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(lastMove.fromC * CELL_SIZE, lastMove.fromR * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.fillRect(lastMove.toC * CELL_SIZE, lastMove.toR * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    if (selectedSquare) {
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedSquare.c * CELL_SIZE, selectedSquare.r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        validMoves.forEach(m => {
            ctx.beginPath();
            ctx.arc(m.toC * CELL_SIZE + CELL_SIZE/2, m.toR * CELL_SIZE + CELL_SIZE/2, CELL_SIZE/6, 0, Math.PI*2);
            ctx.fill();
        });
    }

    ctx.font = `${CELL_SIZE * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) {
                ctx.fillStyle = '#000';
                ctx.fillText(PIECES[p], c * CELL_SIZE + CELL_SIZE/2, r * CELL_SIZE + CELL_SIZE/2);
            }
        }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, BOARD_SIZE, CANVAS_WIDTH, UI_HEIGHT);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    const status = gameOver ? `GAME OVER: ${winMessage}` : `Turn: ${turn === 'W' ? 'White' : 'Black'}`;
    ctx.fillText(status, 10, BOARD_SIZE + 25);
    
    ctx.font = '12px Arial';
    ctx.fillText(`Moves: ${moveHistory.length}`, 10, BOARD_SIZE + 50);
}

initGame();