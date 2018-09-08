import { buttonState, buttonPress } from '/game/cyber/input';
import { frameDT } from '/game/cyber/time';
import { vec3Set } from '/game/cyber/vec';
import { clamp } from '/game/cyber/util';

// Maximum player speed, units per second.
const playerSpeed = 3;
// Player acceleration, units per second squared.
const playerAccel = 15;
// Keyboard turning speed, radians per second.
const playerTurnSpeed = 3;
// Keyboard turning acceleration, radians per second squared.
const playerTurnAccel = 15;
// Mouse turning speed, radians per pixel.
const playerTurnSensitivity = 3e-3;

// The player position [x, y, z] in the world.
export let playerPos;
// Current player velocity [x, y, z], units per second.
let playerVel;
// Curent angle the player is looking at, [yaw, pitch, roll].
// Yaw: 0: +X, pi/2: +Y.
// Pitch: 0: horizontal, pi/2: +Z.
export let playerAngle;
// Current angular velocity, yaw only.
let playerAngleVel;

export function startPlayer() {
  playerPos = [0, -1, 0.5];
  playerVel = [0, 0, 0];
  playerAngle = [1.5, 0, 0];
  playerAngleVel = 0;
}

export function updatePlayer() {
  // Update player angles.
  {
    const xLook = playerTurnSensitivity * buttonPress['x'];
    const yLook = playerTurnSensitivity * buttonPress['y'];
    let rMove = (buttonState['L'] - buttonState['R']) * playerTurnSpeed;
    let accelDV = frameDT * playerTurnAccel;
    playerAngleVel = Math.abs(rMove - playerAngleVel) <= accelDV
      ? rMove
      : playerAngleVel + accelDV * Math.sign(rMove - playerAngleVel);
    playerAngle[0] = (playerAngle[0] + playerAngleVel * frameDT - xLook)
      % (2 * Math.PI);
    playerAngle[1] = clamp(playerAngle[1] + yLook, -1.5, 1.5);
  }

  // Update player velocity.
  /* eslint prefer-const: off */
  let [xVel, yVel, zVel] = playerVel;
  {
    const forwardMove = buttonState['f'] - buttonState['b'];
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
  vec3Set(playerVel, xVel, yVel, zVel);

  // Update player position
  let [xPos, yPos, zPos] = playerPos;
  xPos += xVel * frameDT;
  yPos += yVel * frameDT;
  vec3Set(playerPos, xPos, yPos, zPos);
}
