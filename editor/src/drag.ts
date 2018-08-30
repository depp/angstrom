let gX: number = 0, gY: number = 0;
let gElement: HTMLElement | null = null;
let gUpdateFunc: ((dx: number, dy: number) => void) | null = null;
let gEndFunc: (() => void) | null = null;

function pointerMove(e: PointerEvent): void {
  e.preventDefault();
  e.stopPropagation();
  gUpdateFunc!(e.clientX - gX, e.clientY - gY);
}

function pointerUp(e: PointerEvent): void {
  gElement!.removeEventListener("pointermove", pointerMove, true);
  gElement!.removeEventListener("pointerup", pointerUp, true);
  gElement!.releasePointerCapture(e.pointerId);
  pointerMove(e);
  end();
}

function end(): void {
  gEndFunc!();
  gElement = null;
  gUpdateFunc = null;
  gEndFunc = null;
}

export function drag(elt: HTMLElement, e: PointerEvent,
                     update: (dx: number, dy: number) => void,
                     end: () => void): void {
  if (gElement !== null) {
    end();
  }
  gX = e.clientX;
  gY = e.clientY;
  gElement = elt;
  gUpdateFunc = update;
  gEndFunc = end;
  e.preventDefault();
  e.stopPropagation();
  elt.addEventListener("pointermove", pointerMove, true);
  elt.addEventListener("pointerup", pointerUp, true);
  elt.setPointerCapture(e.pointerId);
}
