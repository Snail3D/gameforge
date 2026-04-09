class Paddle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 100;
    }

    draw(ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}