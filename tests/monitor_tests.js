const tolMs = 100;
const reportedEvents = [];

// Stub out reporting methods for testing
MonitorInternals.reportIdle = time => reportedEvents.push({
  status: "idle",
  time
});

MonitorInternals.reportActive = time => reportedEvents.push({
  status: "active",
  time
});

// Test function wrapper that cleans up reported events array
const withCleanup = getCleanupWrapper({
  before() {
    MonitorInternals.onWindowFocus();
    MonitorInternals.idleThreshold = null;
    MonitorInternals.idleOnBlur = false;
    // http://stackoverflow.com/a/1232046/586086
    return reportedEvents.length = 0;
  },

  after() {
    try {
      return UserStatus.stopMonitor();
    } catch (error) {}
  }
});

// This is a 2x2 test of all possible cases

Tinytest.add("monitor - idleOnBlur and window blurred", function (test) {
  MonitorInternals.idleThreshold = 60000;
  MonitorInternals.idleOnBlur = true;

  const activity = Date.now();
  const newTime = activity + 120000;

  test.equal(MonitorInternals.computeState(activity, activity, false), true);
  // Should not change if we go idle
  return test.equal(MonitorInternals.computeState(activity, newTime, false), true);
});

Tinytest.add("monitor - idleOnBlur and window focused", function (test) {
  MonitorInternals.idleThreshold = 60000;
  MonitorInternals.idleOnBlur = true;

  const activity = Date.now();
  const newTime = activity + 120000;

  test.equal(MonitorInternals.computeState(activity, activity, true), false);
  // Should change if we go idle
  return test.equal(MonitorInternals.computeState(activity, newTime, true), true);
});

Tinytest.add("monitor - idle below threshold", function (test) {
  MonitorInternals.idleThreshold = 60000;
  MonitorInternals.idleOnBlur = false;

  const activity = Date.now();
  test.equal(MonitorInternals.computeState(activity, activity, true), false);
  // Shouldn't change if we go out of focus
  return test.equal(MonitorInternals.computeState(activity, activity, false), false);
});

Tinytest.add("monitor - idle above threshold", function (test) {
  MonitorInternals.idleThreshold = 60000;
  MonitorInternals.idleOnBlur = false;

  const activity = Date.now();
  const newTime = activity + 120000;

  test.equal(MonitorInternals.computeState(activity, newTime, true), true);
  // Shouldn't change if we go out of focus
  return test.equal(MonitorInternals.computeState(activity, newTime, false), true);
});

// We need to wait for TimeSync to run or errors will ensue.
Tinytest.addAsync("monitor - wait for timesync", (test, next) => Deps.autorun(function (c) {
  if (TimeSync.isSynced()) {
    c.stop();
    return next();
  }
}));

Tinytest.add("monitor - start with default settings", withCleanup(function (test) {
  UserStatus.startMonitor();

  test.equal(UserStatus.isMonitoring(), true);
  test.isTrue(UserStatus.lastActivity());

  test.equal(MonitorInternals.idleThreshold, 60000);
  return test.equal(MonitorInternals.idleOnBlur, false);
}));

Tinytest.add("monitor - start with window focused, and idleOnBlur = false", withCleanup(function (test) {
  UserStatus.startMonitor({
    threshold: 30000,
    idleOnBlur: false
  });

  const timestamp = Deps.nonreactive(() => TimeSync.serverTime());

  test.equal(MonitorInternals.idleThreshold, 30000);
  test.equal(MonitorInternals.idleOnBlur, false);

  Deps.flush();

  test.equal(UserStatus.isIdle(), false);
  test.isTrue(Math.abs(UserStatus.lastActivity() - timestamp) < tolMs);
  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "active");
  return test.isTrue(Math.abs((reportedEvents[0] != null ? reportedEvents[0].time : undefined) - timestamp) < tolMs);
}));

Tinytest.add("monitor - start with window focused, and idleOnBlur = true", withCleanup(function (test) {
  UserStatus.startMonitor({
    threshold: 30000,
    idleOnBlur: true
  });

  const timestamp = Deps.nonreactive(() => TimeSync.serverTime());

  test.equal(MonitorInternals.idleThreshold, 30000);
  test.equal(MonitorInternals.idleOnBlur, true);

  Deps.flush();

  test.equal(UserStatus.isIdle(), false);
  test.isTrue(Math.abs(UserStatus.lastActivity() - timestamp) < tolMs);
  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "active");
  return test.isTrue(Math.abs((reportedEvents[0] != null ? reportedEvents[0].time : undefined) - timestamp) < tolMs);
}));

Tinytest.add("monitor - start with window blurred, and idleOnBlur = false", withCleanup(function (test) {
  MonitorInternals.onWindowBlur();

  UserStatus.startMonitor({
    threshold: 30000,
    idleOnBlur: false
  });

  const timestamp = Deps.nonreactive(() => TimeSync.serverTime());

  test.equal(MonitorInternals.idleThreshold, 30000);
  test.equal(MonitorInternals.idleOnBlur, false);

  Deps.flush();

  test.equal(UserStatus.isIdle(), false);
  test.isTrue(Math.abs(UserStatus.lastActivity() - timestamp) < tolMs);
  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "active");
  return test.isTrue(Math.abs((reportedEvents[0] != null ? reportedEvents[0].time : undefined) - timestamp) < tolMs);
}));

Tinytest.add("monitor - start with window blurred, and idleOnBlur = true", withCleanup(function (test) {
  MonitorInternals.onWindowBlur();

  UserStatus.startMonitor({
    threshold: 30000,
    idleOnBlur: true
  });

  const timestamp = Deps.nonreactive(() => TimeSync.serverTime());

  test.equal(MonitorInternals.idleThreshold, 30000);
  test.equal(MonitorInternals.idleOnBlur, true);

  Deps.flush();

  test.equal(UserStatus.isIdle(), true);
  test.isTrue(Math.abs(UserStatus.lastActivity() - timestamp) < tolMs);
  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "idle");
  return test.isTrue(Math.abs((reportedEvents[0] != null ? reportedEvents[0].time : undefined) - timestamp) < tolMs);
}));

Tinytest.add("monitor - ignore actions when window is blurred with idleOnBlur = true", withCleanup(function (test) {

  UserStatus.startMonitor({
    idleOnBlur: true
  });
  Deps.flush();

  const startTime = UserStatus.lastActivity();

  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "active");
  test.isTrue(Math.abs((reportedEvents[0] != null ? reportedEvents[0].time : undefined) - startTime) < tolMs);

  MonitorInternals.onWindowBlur();
  Deps.flush();

  test.length(reportedEvents, 2);
  test.equal(reportedEvents[1] != null ? reportedEvents[1].status : undefined, "idle");

  UserStatus.pingMonitor();

  // Shouldn't have changed
  test.length(reportedEvents, 2);
  return test.equal(UserStatus.lastActivity(), startTime);
}));

Tinytest.add("monitor - stopping while idle unsets idle state", withCleanup(function (test) {

  UserStatus.startMonitor({
    idleOnBlur: true
  });
  Deps.flush();

  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "active");

  const startTime = UserStatus.lastActivity();

  // Simulate going idle immediately using blur
  MonitorInternals.onWindowBlur();
  Deps.flush();

  test.length(reportedEvents, 2);
  test.equal(reportedEvents[1] != null ? reportedEvents[1].status : undefined, "idle");

  test.equal(UserStatus.isIdle(), true);
  test.equal(UserStatus.lastActivity(), startTime);

  UserStatus.stopMonitor();
  Deps.flush();

  test.length(reportedEvents, 3);
  test.equal(reportedEvents[2] != null ? reportedEvents[2].status : undefined, "active");

  test.equal(UserStatus.isIdle(), false);
  return test.equal(UserStatus.lastActivity(), undefined);
}));

Tinytest.addAsync("monitor - stopping and restarting grabs new start time", withCleanup(function (test, next) {

  UserStatus.startMonitor({
    idleOnBlur: true
  });
  Deps.flush();

  const start1 = UserStatus.lastActivity();

  UserStatus.stopMonitor();
  Deps.flush();

  return Meteor.setTimeout(function () {
    UserStatus.startMonitor({
      idleOnBlur: true
    });
    Deps.flush();

    const start2 = UserStatus.lastActivity();

    test.isTrue(start2 > start1);
    return next();
  }, 50);
}));

Tinytest.add("monitor - idle state reported across a disconnect", withCleanup(function (test) {

  UserStatus.startMonitor({
    idleOnBlur: true
  });
  Deps.flush();

  test.length(reportedEvents, 1);
  test.equal(reportedEvents[0] != null ? reportedEvents[0].status : undefined, "active");

  // Simulate going idle immediately using blur
  MonitorInternals.onWindowBlur();
  Deps.flush();

  test.length(reportedEvents, 2);
  test.equal(reportedEvents[1] != null ? reportedEvents[1].status : undefined, "idle");

  MonitorInternals.connectionChange(false, true);
  MonitorInternals.connectionChange(true, false);

  test.length(reportedEvents, 3);
  return test.equal(reportedEvents[2] != null ? reportedEvents[2].status : undefined, "idle");
}));