###
  The idle monitor watches for mouse, keyboard, and blur events,
  and reports idle status to the server.

  It uses TimeSync to report accurate time.

  Everything is reactive, of course!
###


# TODO: catch window blur events where supported

monitorId = null

start = (threshold, interval) ->
  throw new Error("Idle monitor is already active. Stop it first.") if monitorId

  threshold = 30000 unless threshold
  interval = 1000 unless interval
  # Cancel existing if necessary
  stop()
  reset()

  # TODO Attach monitor events to window blur and body

  # Set new monitoring interval
  monitorId = Meteor.setInterval(@monitor, interval)

stop = ->
  return unless monitorId
  Metero.clearInterval(monitorId)
  monitorId = null

reset = ->
  return unless monitorId

  currentTime = Date.now()
  inactiveTime = currentTime - @lastInactive

  @callback?(inactiveTime) if inactiveTime > @inactivityThreshold

  @lastInactive = currentTime

monitor = ->
  currentTime = Date.now()
  inactiveTime = currentTime - @lastInactive

  return unless inactiveTime > @inactivityThreshold

  Meteor.call "record-inactive", {
    start: @lastInactive,
    time: inactiveTime
  }

  @callback?(inactiveTime)

# TODO: export functions for starting and stopping idle monitor
UserStatus = {}
