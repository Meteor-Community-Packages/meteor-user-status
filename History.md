## vNEXT

* Exported `UserStatus` and `UserSessions` using the new API.
* Moved the user status information into the `status` field instead of the `profile` field, which is user editable by default. (#8)
* Introduced a last login time for each session. (#8)
* Added some basic tests.

## v0.1.7

* Fixed a nuanced bug with the use of `upsert`.

## v0.1.6

* Changed `find`/`insert`/`update` to a single upsert instead (#3, #6).
