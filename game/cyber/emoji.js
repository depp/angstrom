const ecanvas = document.createElement('canvas');
ecanvas.width = 256;
ecanvas.height = 256;
const ctx = ecanvas.getContext('2d');
ctx.fillText('Generated image', 20, 20);
ecanvas.toBlob((b) => {
  const elt = document.createElement('img');
  elt.src = URL.createObjectURL(b);
  document.body.appendChild(elt);
  console.log('Have image');
});
