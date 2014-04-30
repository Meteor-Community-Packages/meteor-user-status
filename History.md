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
