function isValid(r, c) { 
    return r >= 0 && r < 8 && c >= 0 && c < 8; 
}

function isWhite(p) { 
    return p !== '' && p === p.toUpperCase(); 
}

function isBlack(p) { 
    return p !== '' && p === p.toLowerCase(); 
}

function getColName(c) {
    return String.fromCharCode(97 + c);
}

function getRowName(r) {
    return 8 - r;
}