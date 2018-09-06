const emoji = '💣 🌤 😭'.split(' ');
const ecanvas = document.createElement('canvas');
ecanvas.width = 256;
ecanvas.height = 256;
const ctx = ecanvas.getContext('2d');
ctx.font = '48px "Noto Color Emoji"';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
let idx = 0;
for (const e of emoji) {
  ctx.fillText(e, idx * 64 + 32, 32);
  idx++;
}

function drawGrid(size) {
  const { width, height } = ecanvas;
  for (let x = size; x < width; x += size) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let x = size; x < width; x += size) {
    ctx.moveTo(0, x);
    ctx.lineTo(width, x);
  }
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();
}

drawGrid(64);

ecanvas.toBlob((b) => {
  const elt = document.createElement('img');
  elt.src = URL.createObjectURL(b);
  elt.style = 'border: 2px solid white';
  document.body.appendChild(elt);
});
