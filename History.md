## vNEXT

## v0.6.7

* Remove jQuery dependency

## v0.6.6

* Declare dependent packages explicitly for Meteor 1.2.

## v0.6.5

* Detect pause/resume events in Cordova. (#47, #64)

## v0.6.4

* Improve consistency of the `status.online` and `status.idle` fields. (#31)

## v0.6.3

* Update usage of the Mongo Collection API for Meteor 0.9.1+.
* Add compatibility for the `audit-argument-checks` package.

## v0.6.2

* Fix constraint syntax for the released Meteor 0.9.0.

## v0.6.1

* **Updated for Meteor 0.9.**

## v0.6.0

* Connections now record user agents - useful for diagnostic purposes. See the demo at http://user-status.meteor.com/.
* The `lastLogin` field of documents in `Meteor.users` is **no longer a date**; it is an object with fields `date`, `ipAddr`, and `userAgent`. **Use `lastLogin.date` instead of simply `lastlogin` if you were depending on this behavior.** This provides a quick way to display connected users' IPs and UAs for administration or diagnostic purposes.
* Better handling of idle/active events if TimeSync loses its computed offset temporarily due to a clock change.

## v0.5.0

* All connections are tracked, including anonymous (not authenticated) ones. Idle monitoring is supported on anonymous connections, and idle state will persist across a login/logout. (#22)
* The `Meteor.onConnection`, `connection.onClose`, and `Accounts.onLogin` functions are used to handle most changes in user state, except for logging out which is not directly supported in Meteor. This takes advantage of Meteor's new DDP heartbeats, and should improve issues with dangling connections caused by unclosed SockJS sockets. (#26)
* Ensure that the last activity timestamp is reset when restarting the idle monitor after stopping it. (#27)
* Add several unit tests for client-side idle monitoring logic.

## v0.4.1

* Ensure that the latest activity timestamp updates when focusing into the app's window.

## v0.4.0

* Store all dates as native `Date` objects in the database (#20). Most usage will be unaffected due to many libraries supporting the interchangeable use of `Date` objects or integer timestamps, but **some behavior may change when using operations with automatic type coercion, such as addition**.

## v0.3.5

* Add some shim code for better compatibility with fast-render. (#24)

## v0.3.4

* Fix an issue with properly recording the user's latest idle time across a reconnection.
* Ignore actions generated while the window is blurred with `idleOnBlur` enabled.

## v0.3.3

* Refactored server-side code so that it was more testable, and added multiplexing tests.
* Fixed an issue where idle state would not be maintained if a connection was interrupted.

## v0.3.2

* Fixed an issue where stopping the idle monitor could leave the client in an idle state.

## v0.3.1

* Added multiplexing of idle status to `Meteor.users` as requested by @timhaines.

## v0.3.0

* Added opt-in automatic **idle monitoring** on the client, which is reported to the server. See the demo app.
* Export a single `UserStatus` variable on the server and the client, that contains all operations. **Breaks compatibility with previous usage:** the previous `UserStatus` variable is now `UserStatus.events`.
* The `sessionLogin` and `sessionLogout` events have been renamed `connectionLogin` and `connectionLogout` along with the new `connectionIdle` and `connectionActive` events. **Breaks compatibility with previous usage.**
* In callbacks, `sessionId` has also been renamed `connectionId` as per the Meteor change.

## v0.2.0

* Exported `UserStatus` and `UserSessions` using the new API.
* Moved the user status information into the `status` field instead of the `profile` field, which is user editable by default. **NOTE: this introduces a breaking change.** (#8)
* Introduced a last login time for each session, and a combined time for the status field. (#8)
* Added some basic tests.

## v0.1.7

* Fixed a nuanced bug with the use of `upsert`.

## v0.1.6

* Changed `find`/`insert`/`update` to a single upsert instead (#3, #6).
