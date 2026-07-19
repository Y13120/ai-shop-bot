const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const size = 64;
const c = createCanvas(size, size);
const ctx = c.getContext('2d');

const bg = ctx.createLinearGradient(0, 0, size, size);
bg.addColorStop(0, '#050510');
bg.addColorStop(1, '#0a0a20');
ctx.fillStyle = bg;
ctx.beginPath();
ctx.roundRect(0, 0, size, size, 12);
ctx.fill();

const grad = ctx.createLinearGradient(8, 8, size - 8, size - 8);
grad.addColorStop(0, '#0fa');
grad.addColorStop(1, '#06f');
ctx.font = 'bold 34px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = grad;
ctx.fillText('AI', size / 2, size / 2 + 2);

const buf = c.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'favicon.png'), buf);
console.log('✅ favicon.png created (' + buf.length + ' bytes)');
