/* globals window, document */

import { Meteor } from 'meteor/meteor';
import { TimeSync } from 'meteor/mizzao:timesync';
import { Tracker } from 'meteor/tracker';
/*
  The idle monitor watches for mouse, keyboard, and blur events,
  and reports idle status to the server.

  It uses TimeSync to report accurate time.

  Everything is reactive, of course!
*/

// State variables
let monitorId = null;
let idle = false;
let lastActivityTime = undefined;

const monitorDep = new Tracker.Dependency;
const idleDep = new Tracker.Dependency;
const activityDep = new Tracker.Dependency;

let focused = true;

// These settings are internal or exported for test only
var MonitorInternals = {
  idleThreshold: null,
  idleOnBlur: false,

  computeState(lastActiveTime, currentTime, isWindowFocused) {
    const inactiveTime = currentTime - lastActiveTime;
    if (MonitorInternals.idleOnBlur && !isWindowFocused) {
      return true;
    }
    if (inactiveTime > MonitorInternals.idleThreshold) {
      return true;
    } else {
      return false;
    }
  },

  connectionChange(isConnected, wasConnected) {
    // We only need to do something if we reconnect and we are idle
    // Don't get idle status reactively, as this function only
    // takes care of reconnect status and doesn't care if it changes.

    // Note that userId does not change during a resume login, as designed by Meteor.
    // However, the idle state is tied to the connection and not the userId.
    if (isConnected && !wasConnected && idle) {
      return MonitorInternals.reportIdle(lastActivityTime);
    }
  },

  onWindowBlur() {
    focused = false;
    return monitor();
  },

  onWindowFocus() {
    focused = true;
    // Focusing should count as an action, otherwise "active" event may be
    // triggered at some point in the past!
    return monitor(true);
  },

  reportIdle(time) {
    return Meteor.call('user-status-idle', time);
  },

  reportActive(time) {
    return Meteor.call('user-status-active', time);
  }

};

const start = (settings) => {
  if (!TimeSync.isSynced()) {
    throw new Error('Can\'t start idle monitor until synced to server');
  }
  if (monitorId) {
    throw new Error('Idle monitor is already active. Stop it first.');
  }

  settings = settings || {};

  // The amount of time before a user is marked idle
  MonitorInternals.idleThreshold = settings.threshold || 60000;

  // Don't check too quickly; it doesn't matter anyway: http://stackoverflow.com/q/15871942/586086
  const interval = Math.max(settings.interval || 1000, 1000);

  // Whether blurring the window should immediately cause the user to go idle
  MonitorInternals.idleOnBlur = (settings.idleOnBlur != null) ? settings.idleOnBlur : false;

  // Set new monitoring interval
  monitorId = Meteor.setInterval(monitor, interval);
  monitorDep.changed();

  // Reset last activity; can't count inactivity from some arbitrary time
  if (lastActivityTime == null) {
    lastActivityTime = Tracker.nonreactive(() => TimeSync.serverTime());
    activityDep.changed();
  }

  monitor();
};

const stop = () => {
  if (!monitorId) {
    throw new Error('Idle monitor is not running.');
  }

  Meteor.clearInterval(monitorId);
  monitorId = null;
  lastActivityTime = undefined; // If monitor started again, we shouldn't re-use this time
  monitorDep.changed();

  if (idle) { // Un-set any idleness
    idle = false;
    idleDep.changed();
    // need to run this because the Tracker below won't re-run when monitor is off
    MonitorInternals.reportActive(Tracker.nonreactive(() => TimeSync.serverTime()));
  }

};

var monitor = (setAction) => {
  // Ignore focus/blur events when we aren't monitoring
  if (!monitorId) {
    return;
  }

  // We use setAction here to not have to call serverTime twice. Premature optimization?
  const currentTime = Tracker.nonreactive(() => TimeSync.serverTime());
  // Can't monitor if we haven't synced with server yet, or lost our sync.
  if (currentTime == null) {
    return;
  }

  // Update action as long as we're not blurred and idling on blur
  // We ignore actions that happen while a client is blurred, if idleOnBlur is set.
  if (setAction && (focused || !MonitorInternals.idleOnBlur)) {
    lastActivityTime = currentTime;
    activityDep.changed();
  }

  const newIdle = MonitorInternals.computeState(lastActivityTime, currentTime, focused);

  if (newIdle !== idle) {
    idle = newIdle;
    idleDep.changed();
  }
};

const touch = () => {
  if (!monitorId) {
    Meteor._debug('Cannot touch as idle monitor is not running.');
    return;
  }
  return monitor(true); // Check for an idle state change right now
};

const isIdle = () => {
  idleDep.depend();
  return idle;
};

const isMonitoring = () => {
  monitorDep.depend();
  return (monitorId != null);
};

const lastActivity = () => {
  if (!isMonitoring()) {
    return;
  }
  activityDep.depend();
  return lastActivityTime;
};

Meteor.startup(() => {
  // Listen for mouse and keyboard events on window
  // TODO other stuff - e.g. touch events?
  window.addEventListener('click', () => monitor(true));
  window.addEventListener('keydown', () => monitor(true));

  // catch window blur events when requested and where supported
  // We'll use jQuery here instead of window.blur so that other code can attach blur events:
  // http://stackoverflow.com/q/22415296/586086
  window.addEventListener('blur', MonitorInternals.onWindowBlur);
  window.addEventListener('focus', MonitorInternals.onWindowFocus);

  // Catch Cordova "pause" and "resume" events:
  // https://github.com/mizzao/meteor-user-status/issues/47
  if (Meteor.isCordova) {
    document.addEventListener('pause', MonitorInternals.onWindowBlur);
    document.addEventListener('resume', MonitorInternals.onWindowFocus);
  }

  // First check initial state if window loaded while blurred
  // Some browsers don't fire focus on load: http://stackoverflow.com/a/10325169/586086
  focused = document.hasFocus();

  // Report idle status whenever connection changes
  Tracker.autorun(() => {
    // Don't report idle state unless we're monitoring
    if (!isMonitoring()) {
      return;
    }

    // XXX These will buffer across a disconnection - do we want that?
    // The idle report will result in a duplicate message (with below)
    // The active report will result in a null op.
    if (isIdle()) {
      MonitorInternals.reportIdle(lastActivityTime);
    } else {
      // If we were inactive, report that we are active again to the server
      MonitorInternals.reportActive(lastActivityTime);
    }
  });

  // If we reconnect and we were idle, make sure we send that upstream
  let wasConnected = Meteor.status().connected;
  return Tracker.autorun(() => {
    const {
      connected
    } = Meteor.status();
    MonitorInternals.connectionChange(connected, wasConnected);

    wasConnected = connected;
  });
});

// export functions for starting and stopping idle monitor
export const UserStatus = {
  startMonitor: start,
  stopMonitor: stop,
  pingMonitor: touch,
  isIdle,
  isMonitoring,
  lastActivity
};
