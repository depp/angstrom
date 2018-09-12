import {
  canvas,
  eventLocation,
} from '/game/cyber/global';
import {
  renderText,
  clearText,
} from '/game/cyber/graphics';

const menuStack = [];
let currentMenu;
let hoverItem;

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

function menuMouseMove(event) {
  hoverItem = itemUnderCursor(event);
}

function menuMouseLeave() {
  hoverItem = null;
}

export function startMenu(...items) {
  menuStack.length = 0;
  renderText(items);
  currentMenu = items;
  canvas.addEventListener('click', menuClick);
  canvas.addEventListener('mousemove', menuMouseMove);
  canvas.addEventListener('mouseleave', menuMouseLeave);
}

export function pushMenu(...items) {
  menuStack.push(currentMenu);
  renderText(items);
  currentMenu = items;
}

export function popMenu() {
  currentMenu = menuStack.pop();
  renderText(currentMenu);
}

export function stopMenu() {
  clearText();
  currentMenu = null;
  canvas.removeEventListener('click', menuClick);
  canvas.removeEventListener('mousemove', menuMouseMove);
  canvas.removeEventListener('mouseleave', menuMouseLeave);
}

export function updateMenu() {
  for (const item of currentMenu) {
    if (item.action) {
      item.color = item == hoverItem ? 0xff0000ff : 0xffcccccc;
    }
  }
}
