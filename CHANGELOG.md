# Changelog

All the features, fixes and breaking changes of the plugin, generated from its history by
[git-cliff](https://git-cliff.org).

## Unreleased

### Features

- **log**: say a commit of one's own is in review, or rejected ([42ab747](https://github.com/jubianchi/claude-dev-null/commit/42ab747bb77491833c8c8929a0b5fd921f4c4e95))

## [0.8.0] - 2026-10-26

### Features

- **api**: vote in the poll of a commit ([ff137a0](https://github.com/jubianchi/claude-dev-null/commit/ff137a0e64da0cbc1221c1a6cfb09173cd5eaaef))
- **log**: vote in a poll from the pane ([37be304](https://github.com/jubianchi/claude-dev-null/commit/37be3046de31f0c885447b59674460ca85230472))
- **log**: gather the settings behind a button, in place of the Account tab ([1f47b9b](https://github.com/jubianchi/claude-dev-null/commit/1f47b9b5efcc6184338f20995003073a54cdba63))
- **log**: show the commits starred in a tab of their own ([8336ae4](https://github.com/jubianchi/claude-dev-null/commit/8336ae4656571520fd139e65f068b2a5db0a005b))
- **log**: read the thread of a commit from the API ([fbd46b3](https://github.com/jubianchi/claude-dev-null/commit/fbd46b300e37b814323718e32e2fced2b73a8389))
- **log**: open the thread of a commit in the pane ([7e551cc](https://github.com/jubianchi/claude-dev-null/commit/7e551ccf683c3dab1f46ff6dd6543996d9ebf6a3))
- **log**: count down beside refresh, and turn auto refresh on from the settings ([b9d5814](https://github.com/jubianchi/claude-dev-null/commit/b9d5814ab6bf2b1a841550079820fc426569e52c))
- **log**: limit the replies shown under each commit and reply ([d81b789](https://github.com/jubianchi/claude-dev-null/commit/d81b789d9680a1a3c43d0b731283727e06f405c1))
- **log**: show so many replies under each commit, chosen in the settings ([e246cb7](https://github.com/jubianchi/claude-dev-null/commit/e246cb74b9de11827e828a158d2f44ece6da79c3))
- **log**: draw neither refresh nor its countdown in the pane ([0f574de](https://github.com/jubianchi/claude-dev-null/commit/0f574de722156a48e887b69b58135c1f9c5e0bb3))
- **log**: show a long commit whole in the pane once Show more is pressed ([93a2213](https://github.com/jubianchi/claude-dev-null/commit/93a221387f77136011b7774e84883fb7845900c8))
- **api**: write whatever the API offers, but commits, on the user's press ([1823a96](https://github.com/jubianchi/claude-dev-null/commit/1823a96d2d15aee2c7bde37f6ef7b20b53aee7be))
- **api**: star a commit, or take its star back, through the API ([6afc9dd](https://github.com/jubianchi/claude-dev-null/commit/6afc9ddb31ad46b132039befa7aac263d3138344))
- **log**: keep the logs at a version of their own once commits say if starred ([7226c35](https://github.com/jubianchi/claude-dev-null/commit/7226c35ae2d0cecfabb492d5d371542083f70300))
- **log**: star the commits of others from the pane ([1e2ce83](https://github.com/jubianchi/claude-dev-null/commit/1e2ce83a6ccde74527fb9a1b4619c8defc110517))
- **log**: show the composer once, above the prompt or in the pane ([330d6ad](https://github.com/jubianchi/claude-dev-null/commit/330d6ad8d09530311fb75dd6fed434a25bbe729b))
- **log**: tell where a log was read to, and the commits arrived above it ([47d6903](https://github.com/jubianchi/claude-dev-null/commit/47d690396a4196556e940fb5dc53fa359517e0a5))
- **log**: load a log again keeping what it showed after its first page ([748f75d](https://github.com/jubianchi/claude-dev-null/commit/748f75dd9656a096e6fe9163f129d4fcf6e88414))
- **log**: keep the place of a log refreshed on its own, the commits arrived above said ([59af58c](https://github.com/jubianchi/claude-dev-null/commit/59af58cd93c869b903744da7dee46fd4878e4556))
- **log**: draw the commits arrived above the log in a badge over it ([bf9670b](https://github.com/jubianchi/claude-dev-null/commit/bf9670bd5950f338c6ad5f2e7ee86e897115cf3e))
- **log**: join the lane of a commit to its replies, one row between threads ([39ce5ea](https://github.com/jubianchi/claude-dev-null/commit/39ce5ea4d11eafbf636007559e41a32331017557))
- **log**: draw replies one level right down to the fourth, not the third ([bbc88dc](https://github.com/jubianchi/claude-dev-null/commit/bbc88dcc5a5fb90edef1a6519d79822bedbf672f))

### Fixes

- **log**: draw the stars and the replies of a commit on one row ([1a06a5b](https://github.com/jubianchi/claude-dev-null/commit/1a06a5b550c987a3f5b0028039f53d30c553ee22))
- **log**: draw the star of a commit as ⭐️, dimmed while not starred ([c0f2b9a](https://github.com/jubianchi/claude-dev-null/commit/c0f2b9a138345803b32b4aa4aebce5a68774c186))
- **compose**: say nothing of an empty message, but its count ([864b916](https://github.com/jubianchi/claude-dev-null/commit/864b916ff65c4921a94897c4d06494cc9d14029c))

## [0.7.0] - 2026-10-23

### Breaking changes

- **log**: read Following as the device approved, and forget the cookie ([8f27162](https://github.com/jubianchi/claude-dev-null/commit/8f27162cba7df811550a4d5f7432129d4216805f))

### Features

- **api**: send the sign-in of the device to the API ([0c36624](https://github.com/jubianchi/claude-dev-null/commit/0c366241e74ae6553164e81152cab73413989f59))
- **api**: start the sign-in of the device and poll for its approval ([bb9fe90](https://github.com/jubianchi/claude-dev-null/commit/bb9fe908f40398fcceec12255b23be31c201e292))
- **account**: sign in the device, from its code to its approval ([af670a1](https://github.com/jubianchi/claude-dev-null/commit/af670a1b4636075aff332976ca535cb897b29cb4))
- **account**: sign in the device from the Account tab ([d8fd511](https://github.com/jubianchi/claude-dev-null/commit/d8fd5119deb8211755dd570a74eb6a2e6aa427bf))
- **api**: approve the device as the app of /dev/null does ([64e873d](https://github.com/jubianchi/claude-dev-null/commit/64e873d6adf7ede6845a7f7b3d13f315de3b879a))
- **account**: approve the device as the app of /dev/null, while it offers no other way ([bf3eadb](https://github.com/jubianchi/claude-dev-null/commit/bf3eadbfa516476044f7efcaf6b35337cba087e8))
- **log**: read Latest and Trending from the API once the device is approved ([d2ae721](https://github.com/jubianchi/claude-dev-null/commit/d2ae721e96450f49e8accdc46cca5c21885e7232))

### Fixes

- **compose**: count a commit as /dev/null does ([ef6ccef](https://github.com/jubianchi/claude-dev-null/commit/ef6ccef59f029b89d56f13ab99a388f0e92681c0))
- **commit**: leave the length of a commit to /dev/null ([f127af7](https://github.com/jubianchi/claude-dev-null/commit/f127af79f3445ab64e3ab95f18a8cbd66e1afee2))
- **release**: take an announcement of one character ([a16738b](https://github.com/jubianchi/claude-dev-null/commit/a16738b2283958646626226da5f6ede2ffc5a244))
- **log**: thread the quotes of a commit among its replies ([20798cc](https://github.com/jubianchi/claude-dev-null/commit/20798ccedb26b88a00bba78b480a212e001ad472))
- **log**: link to the thread an author continues, as /dev/null does ([be75519](https://github.com/jubianchi/claude-dev-null/commit/be75519dd4115b3317dd2705ff23b3b6127e84c9))
- **log**: keep a deleted commit in its thread, as /dev/null does ([61ade32](https://github.com/jubianchi/claude-dev-null/commit/61ade32c3fcc452601fa43b6e799cdfeebc55818))
- **log**: find the ends of a link as /dev/null does ([b0e9ed2](https://github.com/jubianchi/claude-dev-null/commit/b0e9ed2b7259975828f3142b11669c205fda8dcb))
- **log**: show a link to GitHub as GitHub writes it, as /dev/null does ([a14e9db](https://github.com/jubianchi/claude-dev-null/commit/a14e9dbab86e0001a69ba2536ca4cbce767c09d8))
- **log**: link only the mentions /dev/null knows, to whom they mean ([bbd3ab4](https://github.com/jubianchi/claude-dev-null/commit/bbd3ab46fbe60ea233d34637c2120cbff9deb853))
- **log**: draw the parts of a commit, and its link card, as /dev/null does ([99409b1](https://github.com/jubianchi/claude-dev-null/commit/99409b1f2dfba1c613694ba4b8dd50a23f04b9b7))
- **log**: offer no vote where /dev/null takes none ([fad80a3](https://github.com/jubianchi/claude-dev-null/commit/fad80a3c7066a86463afc93d6e2e2e184844ecfb))
- **log**: show the start of a long commit, and of a quote, as /dev/null does ([eec4ec3](https://github.com/jubianchi/claude-dev-null/commit/eec4ec3fe73d1dacd9c17a49dacb4ac71cf8845d))
- **log**: say when the commit quoted was deleted, or is out of sight ([e14eb86](https://github.com/jubianchi/claude-dev-null/commit/e14eb8672cbf7f560180b180fe0e6e40122dd472))
- **account**: fall back on the approval of the app when /dev/null takes no POST to start ([c18d124](https://github.com/jubianchi/claude-dev-null/commit/c18d124f2b16508e7d0724e3a19f599838fe0fc5))

## [0.6.0] - 2026-10-20

### Features

- **api**: build the message a request to the API is signed with ([14396b3](https://github.com/jubianchi/claude-dev-null/commit/14396b3069e44bcf2fcf41291470b5c892f7ea21))
- **api**: create and use the key requests to the API are signed with ([c688b0e](https://github.com/jubianchi/claude-dev-null/commit/c688b0e139f767674a341d3b4866697252e2de47))
- **api**: sign with the key of the device from the hooks module ([4920176](https://github.com/jubianchi/claude-dev-null/commit/4920176a518f786e7b767016879af9597e04fc18))
- **api**: read the API of /dev/null with signed requests ([1da9994](https://github.com/jubianchi/claude-dev-null/commit/1da99940656aa250642cc24d52195c12687b6d58))
- **api**: read a commit of the API ([8df2f0c](https://github.com/jubianchi/claude-dev-null/commit/8df2f0c986eb24359b87f7f87091276cdfeeb465))
- **api**: read a page of a log from the API ([39a0a58](https://github.com/jubianchi/claude-dev-null/commit/39a0a58e8d638ff8b05eda216183ceb308935d93))
- **api**: read the replies of commits from the API ([1fb9bd2](https://github.com/jubianchi/claude-dev-null/commit/1fb9bd23295d6afa908089e7351f39de03458f1c))

## [0.5.0] - 2026-10-19

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
