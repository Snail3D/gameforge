function getPseudoMoves(r, c, piece) {
    if (!piece) return [];
    const isPWhite = isWhite(piece);
    const type = piece.toLowerCase();
    const moves = [];
    
    const dirs = {
        'b': [[-1,-1], [-1,1], [1,-1], [1,1]],
        'r': [[-1,0], [1,0], [0,-1], [0,1]],
        'q': [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]],
        'k': [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]
    };

    if (type === 'p') {
        const dir = isPWhite ? -1 : 1;
        // Forward
        if (isValid(r + dir, c) && board[r + dir][c] === '') {
            moves.push({fromR: r, fromC: c, toR: r + dir, toC: c});
            // Double move
            const startRow = isPWhite ? 6 : 1;
            if (r === startRow && isValid(r + 2 * dir, c) && board[r + 2 * dir][c] === '') {
                moves.push({fromR: r, fromC: c, toR: r + 2 * dir, toC: c});
            }
        }
        // Captures
        [c - 1, c + 1].forEach(nc => {
            if (isValid(r + dir, nc)) {
                const target = board[r + dir][nc];
                if (target && (isPWhite ? isBlack(target) : isWhite(target))) {
                    moves.push({fromR: r, fromC: c, toR: r + dir, toC: nc});
                }
            }
        });
    } else if (type === 'n') {
        const shifts = [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]];
        shifts.forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (isValid(nr, nc)) {
                const target = board[nr][nc];
                if (!target || (isPWhite ? isBlack(target) : isWhite(target))) {
                    moves.push({fromR: r, fromC: c, toR: nr, toC: nc});
                }
            }
        });
    } else if (dirs[type]) {
        dirs[type].forEach(([dr, dc]) => {
            let nr = r + dr;
            let nc = c + dc;
            while (isValid(nr, nc)) {
                const target = board[nr][nc];
                if (!target) {
                    moves.push({fromR: r, fromC: c, toR: nr, toC: nc});
                } else {
                    if (isPWhite ? isBlack(target) : isWhite(target)) {
                        moves.push({fromR: r, fromC: c, toR: nr, toC: nc});
                    }
                    break;
                }
                if (type === 'k') break;
                nr += dr;
                nc += dc;
            }
        });
    }
    return moves;
}

function getLegalMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const isPWhite = isWhite(piece);
    const pseudo = getPseudoMoves(r, c, piece);
    return pseudo.filter(move => {
        const target = board[move.toR][move.toC];
        // Simulate move
        board[move.toR][move.toC] = piece;
        board[move.fromR][move.fromC] = '';
        const safe = !isKingInCheck(isPWhite ? 'W' : 'B');
        // Undo move
        board[move.fromR][move.fromC] = piece;
        board[move.toT ? move.toT : move.toR][move.toC] = target; // Handling broken property names safely
        // Let's use a more robust undo
        board[move.toR][move.toC] = target;
        board[move.fromR][move.fromC] = piece;
        // Re-logic to be clean
        return safe;
    });
}

// Robust version for the simulator
function getLegalMovesClean(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const isPWhite = isWhite(piece);
    const pseudo = getPseudoMoves(r, c, piece);
    const legal = [];

    for (const move of pseudo) {
        const target = board[move.toR][move.toC];
        // Apply
        board[move.toR][move.toC] = piece;
        board[move.fromR][move.fromC] = '';
        
        const kingSide = isPWhite ? 'W' : 'B';
        const check = isKingInCheck(kingSide);
        
        // Revert
        board[move.fromR][move.fromC] = piece;
        board[move.toR][move.toC] = target;

        if (!check) legal.push(move);
    }
    return legal;
}

function isKingInCheck(side) {
    let kingPos = null;
    const kingChar = side === 'W' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingChar) {
                kingPos = {r, c};
                break;
            }
        }
        if (kingPos) break;
    }
    if (!kingPos) return false;

    const opponentSide = side === 'W' ? 'B' : 'W';
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const p = board[r][c];
            if(p && (opponentSide === 'W' ? isWhite(p) : isBlack(p))) {
                const moves = getPseudoMoves(r, c, p);
                if (moves.some(m => m.toR === kingPos.r && m.toC === kingPos.c)) return true;
            }
        }
    }
    return false;
}