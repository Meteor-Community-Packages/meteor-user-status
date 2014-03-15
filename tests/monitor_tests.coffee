# This is a 2x2 test of all possible cases

Tinytest.add "monitor - idleOnBlur and window blurred", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = true

  activity = Date.now()
  newTime = activity + 120000

  test.equal true, MonitorInternals.computeState(activity, activity, false)
  # Should not change if we go idle
  test.equal true, MonitorInternals.computeState(activity, newTime, false)

Tinytest.add "monitor - idleOnBlur and window focused", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = true

  activity = Date.now()
  newTime = activity + 120000

  test.equal false, MonitorInternals.computeState(activity, activity, true)
  # Should change if we go idle
  test.equal true, MonitorInternals.computeState(activity, newTime, true)

Tinytest.add "monitor - idle below threshold", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = false

  activity = Date.now()
  test.equal false, MonitorInternals.computeState(activity, activity, true)
  # Shouldn't change if we go out of focus
  test.equal false, MonitorInternals.computeState(activity, activity, false)

Tinytest.add "monitor - idle above threshold", (test) ->
  MonitorInternals.idleThreshold = 60000
  MonitorInternals.idleOnBlur = false

  activity = Date.now()
  newTime = activity + 120000

  test.equal true, MonitorInternals.computeState(activity, newTime, true)
  # Shouldn't change if we go out of focus
  test.equal true, MonitorInternals.computeState(activity, newTime, false)
