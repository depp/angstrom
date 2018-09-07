import { clamp } from '/game/cyber/util';

// Time since last update, seconds.
export let frameDT;

// Time since the start of the level, seconds.
export let levelTime = 0;

// Animation time of last update, milliseconds.
let lastTimeMS;

// Initialize the time system so the next frame update will have a DT of 0.
export function startTime() {
  lastTimeMS = 0;
}

// Update the game time.
//
// curTimeMS: Animation time, in milliseconds.
export function updateTime(curTimeMS) {
  frameDT = lastTimeMS ? clamp(curTimeMS - lastTimeMS, 0, 250) * 1e-3 : 0;
  levelTime += frameDT;
  lastTimeMS = curTimeMS;
}
