import {
  canvas,
  eventLocation,
} from '/game/cyber/global';
import {
  renderText,
  clearText,
} from '/game/cyber/graphics';

let currentMenu;

/* eslint-disable consistent-return */
function itemUnderCursor(event) {
  let [, y] = eventLocation(event);
  // x = (x + (canvas.clientHeight - canvas.clientWidth) / 2)
  // / canvas.clientHeight;
  y /= canvas.clientHeight;
  for (const item of currentMenu) {
    if (Math.abs(y - item.y) < item.size / 2) {
      return item;
    }
  }
}
/* eslint-enable consistent-return */

function menuClick(event) {
  event.preventDefault();
  const item = itemUnderCursor(event);
  if (item && item.action) {
    item.action();
  }
}

export function startMenu(...items) {
  renderText(items);
  currentMenu = items;
  canvas.addEventListener('click', menuClick);
}

export function stopMenu() {
  clearText();
  currentMenu = null;
  canvas.removeEventListener('click', menuClick);
}
