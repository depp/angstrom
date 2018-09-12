import {
  stateDeadMenu,
  setState,
} from '/game/cyber/global';
import {
  hitPlayer,
  hitMonster,
  PhysicsEntity,
} from '/game/cyber/world';
import { buttonState, buttonPress } from '/game/cyber/input';
import { frameDT, levelTime } from '/game/cyber/time';
import {
  vecZero,
  vecZ,
  vec3Set,
  vec3MulAdd,
} from '/game/cyber/vec';
import { clamp, signedRandom } from '/game/cyber/util';
import { Projectile } from '/game/cyber/projectile';
import {
  modeUIOpaque,
  modeUITransparent,
  modeHidden,
  crosshairSprite,
  heartSprite,
} from '/game/cyber/graphics';
import { shotSFX } from '/game/cyber/sfx';
import { playSFX } from '/game/cyber/audio';
import { Bouncer } from '/game/cyber/chaff';
import { setCamera } from '/game/cyber/camera';

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
// Time after firing before weapon can be fired again, seconds.
const weaponCooldownTime = 0.3;
// Maximum number of hearts.
const maxHearts = 1;

const vTemp = [];

class DeadPlayer extends Bouncer {
  constructor(player) {
    super(player.pos, 0.2,
      [signedRandom() * 2, signedRandom() * 2, Math.random() * 2]);
    this.deathTime = levelTime;
    this.initAngle = [...player.angle];
    this.deltaAngle = [
      signedRandom(),
      -player.angle[1],
      1 - player.angle[2],
    ];
    this.angle = [...vecZero];
  }

  update() {
    super.update();
    setCamera(this);
    vec3MulAdd(
      this.angle, this.initAngle, this.deltaAngle,
      clamp(levelTime - this.deathTime),
    );
    if (levelTime > this.deathTime + 1) {
      setState(stateDeadMenu);
    }
  }
}

export class Player extends PhysicsEntity {
  constructor() {
    super([0, 0, 0.5], 0.5);

    // Curent angle the player is looking at, [yaw, pitch, roll].
    // Yaw: 0: +X, pi/2: +Y.
    // Pitch: 0: horizontal, pi/2: +Z.
    this.angle = [...vecZero];
    // Angular velocity, yaw only.
    this.angleVel = 0;
    // Unit direction vector for where the player is facing.
    this.direction = [...vecZero];
    // Level time when the weapon can be fired again.
    this.weaponCooldown = 0;
    // Current health.
    this.health = maxHearts * 2;
    this.gravity = 1;
    this.doesStep = 1;

    // Appearance.
    this.hearts = [];
    for (let i = 0; i < maxHearts * 2; i++) {
      this.hearts.push({
        n: heartSprite + (i & 1),
        pos: [0.1 + 0.2 * (i >> 1), 0.1, 0],
        size: 0.1,
        anchor: [-1, -1],
      });
    }
    this.sprites = [{
      n: crosshairSprite,
      pos: [0, 0, 0],
      mode: modeUITransparent,
      size: 0.1,
    }, ...this.hearts];
  }

  update() {
    // Update player angles.
    {
      const xLook = playerTurnSensitivity * buttonPress['x'];
      const yLook = playerTurnSensitivity * buttonPress['y'];
      let rMove = (buttonState['L'] - buttonState['R']) * playerTurnSpeed;
      let accelDV = frameDT * playerTurnAccel;
      this.angleVel = Math.abs(rMove - this.angleVel) <= accelDV
        ? rMove
        : this.angleVel + accelDV * Math.sign(rMove - this.angleVel);
      let xAngle = this.angle[0] = (
        (this.angle[0] + this.angleVel * frameDT - xLook)
          % (2 * Math.PI)
      );
      let yAngle = this.angle[1] = clamp(this.angle[1] + yLook, -1.5, 1.5);
      vec3Set(
        this.direction,
        Math.cos(yAngle) * Math.cos(xAngle),
        Math.cos(yAngle) * Math.sin(xAngle),
        Math.sin(yAngle),
      );
    }

    // Update player velocity.
    /* eslint prefer-const: off */
    let [xVel, yVel, zVel] = this.vel;
    {
      const forwardMove = buttonState['f'] - buttonState['b'];
      const strafeMove = buttonState['r'] - buttonState['l'];
      const scale = playerSpeed
            / Math.max(1, Math.hypot(forwardMove, strafeMove));
      const c = Math.cos(this.angle[0]) * scale;
      const s = Math.sin(this.angle[0]) * scale;
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
    vec3Set(this.vel, xVel, yVel, zVel);

    this.updateBody(0); // 1 << hitMonster);

    // Fire the weapon.
    if (levelTime > this.weaponCooldown) {
      if (buttonState['s'] || buttonPress['s']) {
        this.weaponCooldown = (
          this.weaponCooldown || levelTime) + weaponCooldownTime;
        playSFX(shotSFX);
        new Projectile(
          vec3MulAdd(vTemp, this.pos, vecZ, -0.1),
          this.direction, 1 << hitMonster,
        ).spawn();
      } else {
        this.weaponCooldown = 0;
      }
    }

    // Update UI.
    for (let i = 0; i < maxHearts * 2; i += 2) {
      this.hearts[i].mode = i + 2 > this.health ? modeUIOpaque : modeHidden;
      this.hearts[i+1].mode = i < this.health ? modeUIOpaque : modeHidden;
      this.hearts[i+1].size = i == this.health - 1 ? 0.05 : 0.1;
    }
  }

  damage() {
    if (this.dead) {
      // Paranoid safety check.
      return;
    }
    this.health--;
    if (this.health <= 0) {
      this.dead = true;
      new DeadPlayer(this).spawn();
    }
  }

  spawn() {
    super.spawn(hitPlayer);
    setCamera(this);
  }
}
