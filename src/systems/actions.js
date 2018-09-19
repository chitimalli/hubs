<<<<<<< Updated upstream
import { KBMBindings, gamepadBindings } from "./actions/bindings";
=======
import { KBMBindings, TouchscreenBindings } from "./actions/bindings";
>>>>>>> Stashed changes
import { sets } from "./actions/sets";
import { paths } from "./actions/paths";

import MouseDevice from "./actions/devices/mouse";
import KeyboardDevice from "./actions/devices/keyboard";
import SmartMouseDevice from "./actions/devices/smartMouse";
<<<<<<< Updated upstream
import GamepadDevice from "./actions/devices/gamepad";
=======
import TouchscreenDevice from "./actions/touchscreen";
>>>>>>> Stashed changes

function difference(setA, setB) {
  const _difference = new Set(setA);
  setB.forEach(elem => {
    _difference.delete(elem);
  });
  return _difference;
}

function resolvePriorityConflict() {}
function resolve(frame, binding) {
  const { src, dest, xform, priority } = binding;
  const priorityConflict = priority == "conflict";
  if (priorityConflict) {
    resolvePriorityConflict(frame, binding);
  } else {
    xform(frame, src, dest);
  }
}

function applyChange(sets, change) {
  const { set, fn } = change;
  if (fn === "activate") {
    sets.add(set);
  } else if (fn === "deactivate") {
    sets.delete(set);
  }
}

const activeSets = new Set([sets.global]);
const registeredMappings = new Set();

function getActiveBindings() {
  const prioritizedBindings = new Map();
  const activeBindings = new Set();
  registeredMappings.forEach(mapping => {
    activeSets.forEach(setName => {
      const set = mapping[setName] || [];
      set.forEach(binding => {
        const { root, priority } = binding;
        if (!root || !priority) {
          activeBindings.add(binding);
          return;
        }
        if (!prioritizedBindings.has(root)) {
          prioritizedBindings.set(root, binding);
          activeBindings.add(binding);
          return;
        }
        const prevPriority = prioritizedBindings.get(root).priority;
        if (prevPriority > priority) {
          return;
        }
        if (prevPriority < priority) {
          activeBindings.delete(prioritizedBindings.get(root));
          prioritizedBindings.delete(root);
          prioritizedBindings.set(root, binding);
          activeBindings.add(binding);
          return;
        }
        if (prevPriority === priority) {
          console.error("equal priorities on same root", binding, prioritizedBindings.get(root));
          return;
        }
      });
    });
  });
  return activeBindings;
}

const callbacks = [];
let pendingSetChanges = [];
let frame = {};
let activeBindings = new Set();
const activeDevices = new Set();
const gamepads = {};
window.addEventListener(
  "gamepadconnected",
  e => {
    const gamepadDevice = new GamepadDevice(e.gamepad);
    activeDevices.add(gamepadDevice);
    gamepads[e.gamepad.index] = gamepadDevice;
  },
  false
);
window.addEventListener(
  "gamepaddisconnected",
  e => {
    if (gamepads[e.gamepad.index]) {
      activeDevices.delete(gamepads[e.gamepad.index]);
      delete gamepads[e.gamepad.index];
    }
  },
  false
);

AFRAME.registerSystem("actions", {
  init() {
    // TODO: Handle device (dis/re)connection
    activeDevices.add(new MouseDevice());
    activeDevices.add(new SmartMouseDevice());
    activeDevices.add(new KeyboardDevice());
    activeDevices.add(new TouchscreenDevice());

<<<<<<< Updated upstream
    registeredMappings.add(KBMBindings);
    registeredMappings.add(gamepadBindings);
=======
    registeredMappings.add(TouchscreenBindings);
>>>>>>> Stashed changes
  },

  tick() {
    pendingSetChanges.forEach(change => {
      applyChange(activeSets, change);
    });
    pendingSetChanges = [];

    const deviceFrame = {};
    activeDevices.forEach(device => {
      device.write(deviceFrame); // smartMouse runs after mouse
    });

    frame = {};
    Object.assign(frame, deviceFrame);
    activeBindings = getActiveBindings();
    activeBindings.forEach(binding => {
      resolve(frame, binding);
    });

    const cursorController = document.querySelector("[cursor-controller]").components["cursor-controller"];
    cursorController.actionSystemCallback(frame);
    // Callbacks are here to let app code activate or deactivate an action set THIS FRAME.

    const prevActiveSets = new Set(activeSets);
    pendingSetChanges.forEach(change => {
      applyChange(activeSets, change);
    });
    pendingSetChanges = [];
    if (difference(prevActiveSets, activeSets).size || difference(activeSets, prevActiveSets).size) {
      frame = {};
      Object.assign(frame, deviceFrame);
      activeBindings = getActiveBindings();
      activeBindings.forEach(binding => {
        resolve(frame, binding);
      });
    }
    this.debugFrame = frame;
    if (frame[paths.app.logDebugFrame]) {
      console.log(JSON.stringify(this.debugFrame, null, " "));
    }
  },

  poll(path) {
    return frame[path];
  },

  activate(set) {
    pendingSetChanges.push({ set, fn: "activate" });
  },

  deactivate(set) {
    pendingSetChanges.push({ set, fn: "deactivate" });
  },

  registerTickCallback(cb) {
    callbacks.push(cb);
  }
});
