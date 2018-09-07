import { clamp } from '/game/cyber/util';

// Amount of time, in seconds, since last update.
export let frameDT;

let lastTime;

// Initialize the time system so the next frame update will have a DT of 0.
export function startTime() {
  lastTime = 0;
}

// Update the game time.
//
// curTime: Animation time, in milliseconds, a DOMHighResTimeStamp.
export function updateTime(curTime) {
  frameDT = lastTime ? clamp(curTime - lastTime, 0, 250) * 1e-3 : 0;
  lastTime = curTime;
}
