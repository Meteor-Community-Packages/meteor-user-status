if Meteor.isClient
  UserSessions = new Meteor.Collection("user_status_sessions")

  Handlebars.registerHelper "userStatus", UserStatus

  relativeTime = (timeAgo) ->
    diff = moment.utc(TimeSync.serverTime() - timeAgo)
    time = diff.format(" H:mm:ss")
    days = +diff.format("DDD") - 1
    ago = (if days then days + "d" else "") + time
    return new Date(timeAgo).toLocaleString() + " -" + ago + " ago"

  Template.login.events =
    "submit form.login": (e, tmpl) ->
      e.preventDefault()
      username = tmpl.find("input[name=username]").value
      Meteor.insecureUserLogin username, (err, res) -> console.log(err) if err

  Template.login.loggedIn = -> Meteor.userId()

  Template.status.events =
    "submit form.start-monitor": (e, tmpl) ->
      e.preventDefault()
      UserStatus.startMonitor
        threshold: tmpl.find("input[name=threshold]").valueAsNumber
        interval: tmpl.find("input[name=interval]").valueAsNumber
        idleOnBlur: tmpl.find("select[name=idleOnBlur]").value

    "click .stop-monitor": ->
      UserStatus.stopMonitor()

  Template.status.lastActivity = ->
    lastActivity = @lastActivity()
    if lastActivity?
      return relativeTime lastActivity
    else
      return "undefined"

  Template.serverStatus.connections = -> UserSessions.find()

  Template.serverStatus.username = -> Meteor.users.findOne(@userId)?.username

  Template.serverStatus.lastActivity = ->
    lastActivity = @lastActivity
    if lastActivity?
      return relativeTime lastActivity
    else
      return "(active or not monitoring)"

  # Start monitor as soon as we got a signal, captain!
  Deps.autorun ->
    if TimeSync.isSynced()
      UserStatus.startMonitor
        threshold: 30000
        idleOnBlur: true
      @stop()

if Meteor.isServer
  # Try setting this so it works on meteor.com
  # (https://github.com/oortcloud/unofficial-meteor-faq)
  process.env.HTTP_FORWARDED_COUNT = 1

  Meteor.publish null, ->
    [
      Meteor.users.find {},
        fields:
          status: 1,
          username: 1
      UserStatus.sessions.find()
    ]
