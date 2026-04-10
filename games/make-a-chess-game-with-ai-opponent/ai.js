function triggerAiMove() {
    if (isAiThinking || gameOver) return;
    isAiThinking = true;
    setTimeout(() => {
        const move = getBestMove();
        if (move) {
            executeMove(move);
        } else {
            gameOver = true;
            winMessage = "White Wins!";
        }
        isAiThinking = false;
    }, 500);
}

function getBestMove() {
    const blackPieces = [];
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if (board[r][c] && isBlack(board[r][c])) blackPieces.push({r, c});
        }
    }
    const allBlackMoves = [];
    blackPieces.forEach(p => {
        const moves = getPseudoMoves(p.r, p.c, board[p.r][p.c]);
        allBlackMoves.push(...moves);
    });
    
    if (allBlackMoves.length === 0) return null;

    let bestScore = -Infinity;
    let bestMove = null;
    const shuffledMoves = [...allBlackMoves].sort(() => Math.random() * 2 - 1);

    for (const move of shuffledMoves) {
        const target = board[move.toR][move.toC];
        const piece = board[move.fromR][move.fromC];
        
        board[move.toR][move.toC] = piece;
        board[move.fromR][move.fromC] = '';
        const safe = !isKingInCheck('B');
        
        board[move.fromR][move.fromC] = piece;
        board[move.toR][move.toC] = target;

        if (!safe) continue;

        const score = evaluateBoard();
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

function evaluateBoard() {
    let totalEvaluation = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const val = PIECE_VALUES[piece] || 0;
                totalEvaluation += isWhite(piece) ? -val : val; 
            }
        }
    }
    return totalEvaluation;
}