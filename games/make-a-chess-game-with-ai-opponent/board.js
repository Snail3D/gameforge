let board = [];
let turn = 'W';
let gameOver = false;
let winMessage = "";
let lastMove = null; 
let isAiThinking = false; 
let capturedByW = []; 
let capturedByB = []; 
let moveCount = 0;
let moveHistory = [];
let selectedSquare = null;
let validMoves = [];

function initBoard() {
    board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
}

function resetGame() {
    initBoard();
    turn = 'W';
    gameOver = false;
    winMessage = "";
    lastMove = null; 
    isAiThinking = false;
    selectedSquare = null;
    validMoves = [];
    capturedByW = [];
    capturedByB = [];
    moveCount = 0;
    moveHistory = [];
}