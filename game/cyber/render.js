// Module render contains the top-level rendering code.
import { gl } from '/game/cyber/global';
import { renderSky } from '/game/cyber/render_sky';
import { renderSprite } from '/game/cyber/render_sprite';
import { renderText } from '/game/cyber/render_text';
import { renderLevel } from '/game/cyber/render_level';

export function render() {
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0.1, 0.1, 0.1, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  renderLevel();
  renderSky();
  renderSprite();
  renderText();
}
