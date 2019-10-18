# Publishing a new version

- [ ]  Pick an appropriate incremented version number v0.x.y (e.g. 0.4.0 becomes 0.4.1 or 0.5.0 depending on how much changed)
- [ ]  Update the `History.md` file to reflect all changes that will be in the new version. If you've been keeping it up to date (and it appears you have), this just involves inserting the above version number below vNEXT.
- [ ]  Update this version number in `package.js`.
- [ ]  git commit (but don't push yet).
- [ ]  Try `meteor publish`
- [ ]  If everything worked, `git tag v0.x.y` and push the tag (`git push origin v0.x.y`; this allows others to find the code for this version) and merge into master and push that too. (If you aren't rebasing the feature branch you may want to merge first before publishing)
- [ ] If publishing didn't work, you can fix things, amend the commit as necessary, then tag and push after verifying that it went through.

# Travis CI

To be written.

See https://travis-ci.org/Meteor-Community-Packages/meteor-user-status

# Pushing a demo

To be written.

We host the demo at https://user-status.meteorapp.com.

