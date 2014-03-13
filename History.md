## vNEXT

* Export a single `UserStatus` variable on the server and the client, that contains all operations. **Breaks compatibility with previous usage:** the previous `UserStatus` variable is now `UserStatus.events`.
* Added optional automatic idle monitoring on the client, which is reported to the server.

## v0.2.0

* Exported `UserStatus` and `UserSessions` using the new API.
* Moved the user status information into the `status` field instead of the `profile` field, which is user editable by default. **NOTE: this introduces a breaking change.** (#8)
* Introduced a last login time for each session, and a combined time for the status field. (#8)
* Added some basic tests.

## v0.1.7

* Fixed a nuanced bug with the use of `upsert`.

## v0.1.6

* Changed `find`/`insert`/`update` to a single upsert instead (#3, #6).
