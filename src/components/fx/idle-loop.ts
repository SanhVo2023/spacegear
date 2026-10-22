// An animation-frame loop that runs only while there is work, so an idle page requests no frames.

export type FrameScheduler = {
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

/**
 * `tick(time, dt)` runs once per frame and returns whether another frame is needed. `time` is a clock in ms
 * that only advances while the loop runs; `dt` is the frame step in ms, capped at 50 ms. The first frame
 * after a start counts as one 60 Hz frame, so a pause never turns into a jump.
 */
export function createIdleLoop(tick: (time: number, dt: number) => boolean, scheduler: FrameScheduler = browserFrames) {
  let id = 0;
  let last = 0;
  let clock = 0;
  let running = false;
  const frame = (now: number) => {
    const dt = last ? Math.min(now - last, 50) : 1000 / 60;
    last = now;
    clock += dt;
    if (tick(clock, dt)) {
      id = scheduler.request(frame);
    } else {
      running = false;
      last = 0;
    }
  };
  return {
    start() {
      if (running) return;
      running = true;
      id = scheduler.request(frame);
    },
    stop() {
      if (!running) return;
      scheduler.cancel(id);
      running = false;
      last = 0;
    },
    get running() {
      return running;
    },
  };
}
