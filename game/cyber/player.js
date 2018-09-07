import { buttonState } from '/game/cyber/input';
import { frameDT } from '/game/cyber/time';
import { vecSet } from '/game/cyber/vec';

// Maximum player speed, units per second.
const playerSpeed = 3;
// Player acceleration, units per second squared.
const playerAccel = 15;

// The player position in the world.
export let playerPos;
// Current player velocity, units per second.
let playerVel;
// Curent angle the player is looking at, [yaw, pitch, roll].
// Yaw: 0: +X, pi/2: +Y.
// Pitch: 0: horizontal, pi/2: +Z.
export let playerAngle;

export function startPlayer() {
  playerPos = [0, -1, 0];
  playerVel = [0, 0, 0];
  playerAngle = [1.5, 0, 0];
}

export function updatePlayer() {
  // Update player velocity.
  /* eslint prefer-const: off */
  let [xVel, yVel, zVel] = playerVel;
  {
    /* eslint dot-notation: off */
    const forwardMove = buttonState['f'] - buttonState['b'];
    /* eslint dot-notation: off */
    const strafeMove = buttonState['r'] - buttonState['l'];
    const scale = playerSpeed
          / Math.max(1, Math.hypot(forwardMove, strafeMove));
    const c = Math.cos(playerAngle[0]) * scale;
    const s = Math.sin(playerAngle[0]) * scale;
    const xMove = c * forwardMove + s * strafeMove;
    const yMove = s * forwardMove - c * strafeMove;
    const accelDV = playerAccel * frameDT;
    const xDV = xMove - xVel;
    const yDV = yMove - yVel;
    const magDV = Math.hypot(xDV, yDV);
    if (magDV <= accelDV) {
      xVel = xMove;
      yVel = yMove;
    } else {
      xVel += xDV * accelDV / magDV;
      yVel += yDV * accelDV / magDV;
    }
  }
  vecSet(playerVel, xVel, yVel, zVel);

  // Update player position
  let [xPos, yPos, zPos] = playerPos;
  xPos += xVel * frameDT;
  yPos += yVel * frameDT;
  vecSet(playerPos, xPos, yPos, zPos);
}
