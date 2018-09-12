import {
  canvas,
  stateGame,
  setState,
  eventLocation,
} from '/game/cyber/global';
import { startAudio } from '/game/cyber/audio';
import {
  renderText,
  clearText,
} from '/game/cyber/graphics';
import { inputClick } from '/game/cyber/input';

function menuClick(event) {
  event.preventDefault();
  const [x, y] = eventLocation(event);
  console.log(`Mouse click ${x},${y}`);
  startAudio();
  setState(stateGame);
  inputClick();
}

export function startMenu(text) {
  renderText(text);
  canvas.addEventListener('click', menuClick);
}

export function stopMenu() {
  clearText();
  canvas.removeEventListener('click', menuClick);
}
