## Demo/test app for user-status

Note the following cool features:

- All clients are synced to server time using [timesync](https://github.com/mizzao/meteor-timesync), and can make local comparisons even if their actual time is way off.
- Each connection maintains its own idle (or not) state.
- When a client goes idle (by crossing some threshold), the last activity time is recorded for when it started being idle.
