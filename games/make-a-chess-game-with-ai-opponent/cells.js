function isWhite(p) { return p !== '' && p === p.toUpperCase(); }
function isBlack(p) { return p !== '' && p === p.toLowerCase(); }

function getColName(c) {
    return String.fromCharCode(97 + c);
}