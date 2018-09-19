import { paths } from "./paths";
import { Pose } from "./pose";

const cursorPose = "cursorPose";
const cameraDelta = "cameraDelta";
const pinchA = "pinchA";
const pinchB = "pinchB";

const calculateCursorPose = function(camera, coords) {
  const cursorPose = new Pose();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  origin.setFromMatrixPosition(camera.matrixWorld);
  direction
    .set(coords[0], coords[1], 0.5)
    .unproject(camera)
    .sub(origin)
    .normalize();
  cursorPose.fromOriginAndDirection(origin, direction);
  return cursorPose;
};

function distance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export default class Touchscreen {
  constructor() {
    this.events = [];
    this.jobFor = {};
    this.idFor = {};
    this.cameraDeltaClientXY = [0, 0];
    this.pinchAClientXY = undefined;
    this.pinchBClientXY = undefined;
    this.pinchDistance = undefined;
    this.pinch = 0;
    this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 3);

    ["touchstart", "touchend", "touchmove", "touchcancel"].map(x =>
      document.addEventListener(x, this.events.push.bind(this.events))
    );
  }

  start(touch, frame) {
    const { jobFor, idFor } = this;
    const id = touch.identifier;
    if (jobFor[id]) {
      console.error("got touch start for touch whose id is already associated with a job");
      return;
    }

    if (idFor[cursorPose] === undefined) {
      const cursorController = document.querySelector("[cursor-controller]").components["cursor-controller"];
      const rawIntersections = [];
      const camera = document.querySelector("#player-camera").components.camera.camera;
      let coords = {
        x: (touch.clientX / window.innerWidth) * 2 - 1,
        y: -(touch.clientY / window.innerHeight) * 2 + 1
      };
      this.raycaster.setFromCamera(coords, camera);
      this.raycaster.intersectObjects(cursorController.targets, true, rawIntersections);
      const intersection = rawIntersections.find(x => x.object.el);
      const clickedOnAnything =
        intersection &&
        intersection.object.el.matches(".pen, .pen *, .video, .video *, .interactable, .interactable *");
      if (clickedOnAnything) {
        coords = [(touch.clientX / window.innerWidth) * 2 - 1, -(touch.clientY / window.innerHeight) * 2 + 1];
        frame[paths.device.touchscreen.cursorPose] = calculateCursorPose(camera, coords);
        idFor[cursorPose] = id;
        jobFor[id] = cursorPose;
        return;
      }
    }

    if (idFor[cameraDelta] === undefined) {
      idFor[cameraDelta] = id;
      jobFor[id] = cameraDelta;

      this.cameraDeltaClientXY = [touch.clientX, touch.clientY];
      frame[paths.device.touchscreen.cameraDelta] = [0, 0];
      return;
    }

    if (idFor[pinchB] === undefined) {
      delete frame[paths.device.touchscreen.cameraDelta];
      const pinchAId = idFor[cameraDelta];
      this.pinchAClientXY = this.cameraDeltaClientXY;
      this.cameraDeltaClientXY = undefined;
      delete idFor[cameraDelta];

      idFor[pinchA] = pinchAId;
      jobFor[pinchAId] = pinchA;
      idFor[pinchB] = id;
      jobFor[id] = pinchB;

      this.pinchBClientXY = [touch.clientX, touch.clientY];
      this.pinchDistance = distance(this.pinchAClientXY, this.pinchBClientXY);
      this.pinch = 0;
      frame[paths.device.touchscreen.pinch] = this.pinch;
      return;
    }

    console.warn("no job suitable for touch", touch);
  }

  move(touch, frame) {
    const { jobFor, idFor } = this;
    const id = touch.identifier;
    if (!jobFor[id]) {
      console.warn("got touch move for touch whose id is not associated with a job", touch);
      return;
    }

    switch (jobFor[id]) {
      case cursorPose:
        const camera = document.querySelector("#player-camera").components.camera.camera;
        const coords = [(touch.clientX / window.innerWidth) * 2 - 1, -(touch.clientY / window.innerHeight) * 2 + 1];
        frame[paths.device.touchscreen.cursorPose] = calculateCursorPose(camera, coords);
        break;
      case cameraDelta:
        this.cameraDelta[0] += touch.clientX - this.cameraDeltaClientXY[0];
        this.cameraDelta[1] += touch.clientY - this.cameraDeltaClientXY[1];
        frame[paths.device.touchscreen.cameraDelta] = this.cameraDelta;
        this.cameraDeltaClientXY = [touch.clientX, touch.clientY];
        break;
      case pinchA:
        this.pinchAClientXY = [touch.clientX, touch.clientY];
      case pinchB:
        this.pinchBClientXY = [touch.clientX, touch.clientY];
      case pinchA:
      case pinchB:
        const newPinchDistance = distance(this.pinchAClientXY, this.pinchBClientXY);
        this.pinch += newPinchDistance - this.pinchDistance;
        frame[paths.device.touchscreen.pinch] = this.pinch;
        this.pinchDistance = newPinchDistance;
        break;
    }
  }

  end(touch, frame) {
    const { jobFor, idFor } = this;
    const id = touch.identifier;
    if (!jobFor[id]) {
      console.warn("got touch end for touch whose id is not associated with a job", touch);
      return;
    }

    switch (jobFor[id]) {
      case cursorPose:
        delete idFor[cursorPose];
        delete jobFor[id];
        break;
      case cameraDelta:
        this.cameraDeltaClientXY = undefined;
        delete idFor[cameraDelta];
        delete jobFor[id];
        break;
      case pinchB:
        if (idFor[cameraDelta] === undefined && idFor[pinchA] !== undefined) {
          // move pinchA to cameraDelta
          const newCameraDeltaId = idFor[pinchA];
          idFor[cameraDelta] = newCameraDeltaId;
          jobFor[newCameraDeltaId] = cameraDelta;
          delete idFor[pinchA];
          delete jobFor[id];
          break;
        }
      case pinchA:
        if (idFor[cameraDelta] === undefined && idFor[pinchB] !== undefined) {
          // move pinchB to cameraDelta
          const newCameraDeltaId = idFor[pinchB];
          idFor[cameraDelta] = newCameraDeltaId;
          jobFor[newCameraDeltaId] = cameraDelta;
          delete idFor[pinchB];
          delete jobFor[id];
          break;
        } else if (idFor[pinchB] !== undefined) {
          // move pinchB to pinchA
          jobFor[idFor[pinchB]] = pinchA;
          idFor[pinchA] = idFor[pinchB];
          delete jobFor[id];
        }
    }
  }

  process(event, frame) {
    switch (event.type) {
      case "touchstart":
        for (const touch of event.changedTouches) {
          this.start(touch, frame);
        }
        break;
      case "touchmove":
        for (const touch of event.touches) {
          this.move(touch, frame);
        }
        break;
      case "touchend":
      case "touchcancel":
        for (const touch of event.changedTouches) {
          this.end(touch, frame);
        }
        break;
    }
  }

  write(frame) {
    this.pinch = 0; // deltas
    this.cameraDelta = [0, 0];
    this.events.forEach(event => {
      this.process(event, frame);
    });
    while (this.events.length) {
      this.events.pop();
    }
  }
}
