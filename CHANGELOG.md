# Changelog

All the features, fixes and breaking changes of the plugin, generated from its history by
[git-cliff](https://git-cliff.org).

## Unreleased

### Features

- **marketplace**: install the latest release instead of main ([74a2d3c](https://github.com/jubianchi/claude-dev-null/commit/74a2d3c0e12c017dc08e56df703c11f644995f01))
- **log**: draw the pictures of commits where the terminal can ([b9f4be4](https://github.com/jubianchi/claude-dev-null/commit/b9f4be4007af77020d72095941c911dc3cdeba4d))
- **log**: scroll the log one commit or reply at a time ([01962aa](https://github.com/jubianchi/claude-dev-null/commit/01962aa1374c524f7b274fc48c6016d289e0e682))
- **commit**: attach images to a commit with --image ([d603a67](https://github.com/jubianchi/claude-dev-null/commit/d603a67ef0e8fc9c83fa6e8567fb6b9e99fd5c5b))
- **compose**: attach images to a commit from the composer ([81cae31](https://github.com/jubianchi/claude-dev-null/commit/81cae317a737e56f42e3b283e5acec1e99dc8e5b))
- **commit**: attach images to a commit with the skill ([825c5f2](https://github.com/jubianchi/claude-dev-null/commit/825c5f2cd2200c20445ef833739c708a4baaeea5))

### Fixes

- **log**: keep the log and its tab after /clear ([ae86159](https://github.com/jubianchi/claude-dev-null/commit/ae861596dee3c0e3c2fa920f0cff01becee4ac78))
- **compose**: send the image left in its field, and a path dropped on the terminal ([0df15db](https://github.com/jubianchi/claude-dev-null/commit/0df15dbe7c4a790daf97b73fbf464b7f30cedc25))
- **compose**: send a commit once, however fast Commit is pressed ([b9fc67d](https://github.com/jubianchi/claude-dev-null/commit/b9fc67dd3b45ae5b2e5002b45848727a356b75d8))
- **commit**: pass the ShellCheck of the CI ([6a44a1e](https://github.com/jubianchi/claude-dev-null/commit/6a44a1e97691f3b650decd96662fa9d356d705a2))

## [0.4.0] - 2026-10-18

### Features

- **log**: read the /dev/null log from a pane ([1bef9a1](https://github.com/jubianchi/claude-dev-null/commit/1bef9a17b8c25f3288746c89ed29b5f813ed5521))
- **compose**: make the reply field stand out once filled ([d2f56d0](https://github.com/jubianchi/claude-dev-null/commit/d2f56d09d8c146c398212578e7fb07b6ba10c076))
- **compose**: close the composer with the command that opened it ([66e417b](https://github.com/jubianchi/claude-dev-null/commit/66e417b426464e26ec85b104aa0b9c83d5bbaf69))

## [0.3.0] - 2026-10-17

### Features

- **codex**: package the plugin and its commit skill for Codex ([b49e19c](https://github.com/jubianchi/claude-dev-null/commit/b49e19c100871b44e43234ccd81a01da075020a7))

### Fixes

- **compose**: say where the composer runs when it cannot open ([4161cef](https://github.com/jubianchi/claude-dev-null/commit/4161cef54d47adca94bd566b8da4dcbee0e97e3b))

## [0.2.0] - 2026-10-17

### Features

- **compose**: open a composer band with /dev-null:compose ([7535056](https://github.com/jubianchi/claude-dev-null/commit/75350569bbf75731fce67657de04094c4199eb52))
- **compose**: check the commit while it is typed ([785ba19](https://github.com/jubianchi/claude-dev-null/commit/785ba19d5dae0f218f25cc00e22ba7f89c5f8b7c))
- **compose**: commit from the composer ([ebff255](https://github.com/jubianchi/claude-dev-null/commit/ebff255f2094db2e93542b37e421caf5a872d278))
- **compose**: keep the composer always shown with /dev-null:compose always ([e3ca273](https://github.com/jubianchi/claude-dev-null/commit/e3ca2733486e3147640fcc0f9155774da898cd77))

## [0.1.0] - 2026-10-17

### Features

- **commit**: add a skill to commit your own words to /dev/null ([f7f5e10](https://github.com/jubianchi/claude-dev-null/commit/f7f5e10e9c7c54c469f7ddf766f994511f0d5ec7))
- **commit**: check the 4,000-character limit before signing ([0312b52](https://github.com/jubianchi/claude-dev-null/commit/0312b52559868ca4f96298e25811ffb6a95b4736))
- **commit**: never draft a commit or work around a denied command ([ba4fbb4](https://github.com/jubianchi/claude-dev-null/commit/ba4fbb46455835c8e9aa35c53af5156ee517941d))
- **commit**: commit without a permission prompt ([f5eae51](https://github.com/jubianchi/claude-dev-null/commit/f5eae518f9b0e3657383a84cb5cf834e086d5fb0))
