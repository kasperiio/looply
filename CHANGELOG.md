# Changelog

## [1.9.0](https://github.com/kasperiio/looply/compare/v1.8.1...v1.9.0) (2026-08-27)


### Features

* **brand:** replace placeholder icons with the Looply loop mark ([2f131e2](https://github.com/kasperiio/looply/commit/2f131e24b0214c566eb75ae5cb0771e6efdd3c26))

## [1.8.1](https://github.com/kasperiio/looply/compare/v1.8.0...v1.8.1) (2026-08-26)


### Bug Fixes

* **map:** authenticate CARTO basemap requests with an API key ([cc7454c](https://github.com/kasperiio/looply/commit/cc7454c43894f38aacf80d9c9faf41c4c95e488b))

## [1.8.0](https://github.com/kasperiio/looply/compare/v1.7.0...v1.8.0) (2026-08-22)


### Features

* **a11y:** give the controls real semantics and a visible focus ring ([fcf99f8](https://github.com/kasperiio/looply/commit/fcf99f8631d2bb6a9ca164618ba1aacbed2205e4))
* **app:** keep generated routes across a reload ([72fc8d2](https://github.com/kasperiio/looply/commit/72fc8d25da973628b69abc52b89ee2b1712385d8))
* **app:** show routes as they arrive, and cancel superseded runs ([e1e2e35](https://github.com/kasperiio/looply/commit/e1e2e35d3257cea857b56b2de154800a5c7e52f8))
* **seo:** make the page findable and shareable ([16b1117](https://github.com/kasperiio/looply/commit/16b1117e6f91d8289f7633f7c9b9130bd28392df))


### Bug Fixes

* **build:** bundle Leaflet's CSS instead of fetching it from unpkg ([95e5f5e](https://github.com/kasperiio/looply/commit/95e5f5ecf18732011febf26731bb0e6ecd78658f))
* **map:** refit bounds on resize and report geolocation failures ([d0dd51b](https://github.com/kasperiio/looply/commit/d0dd51bfb842206a912a133ab212f76e7ca54dcd))
* **routing:** stop amplifying brouter.de rate limits, halve requests ([41d7a82](https://github.com/kasperiio/looply/commit/41d7a82608bb834831a637f6637644eaa84be0aa))
* **search:** drop the User-Agent header Nominatim never received ([32ecd54](https://github.com/kasperiio/looply/commit/32ecd548811cf04e6f673587286ca8b77722d314))
* **stats:** stop under-reporting ascent on rolling terrain ([78ad926](https://github.com/kasperiio/looply/commit/78ad926dafa6fc49c2d2f4f302fba9b772279408))
* **ui:** stop the stats bar truncating its own values ([dd9a794](https://github.com/kasperiio/looply/commit/dd9a794125d17060caf311c176fc425ec10f3434))
* **ux:** ask before requesting location instead of prompting on load ([313d4b6](https://github.com/kasperiio/looply/commit/313d4b6219337748eaf26d31bae2626f0499e24d))


### Performance Improvements

* **routing:** make spur pruning a single pass, fix nearest-point bias ([8ac9637](https://github.com/kasperiio/looply/commit/8ac9637424d4379ed1381021e05bd926c79dccc3))

## [1.7.0](https://github.com/kasperiio/looply/compare/v1.6.2...v1.7.0) (2026-08-10)


### Features

* **ui:** reach the sidebar faster and ride further ([72858cd](https://github.com/kasperiio/looply/commit/72858cd9377c205572b7833fef3c121b99813081))

## [1.6.2](https://github.com/kasperiio/looply/compare/v1.6.1...v1.6.2) (2026-08-10)


### Bug Fixes

* **pwa:** force clients onto the latest build ([9f7b917](https://github.com/kasperiio/looply/commit/9f7b917adaeb5d41496dab96e8aa8c2dc47019c5))
* **ui:** keep the stats bar on screen on mobile browsers ([8084472](https://github.com/kasperiio/looply/commit/8084472f065fd177751257ebfcd66b0cfa873410))
* **ui:** show the map tips only once ([a7c2c28](https://github.com/kasperiio/looply/commit/a7c2c28bb0ab3dc7b95153854cfafcf3591478aa))

## [1.6.1](https://github.com/kasperiio/looply/compare/v1.6.0...v1.6.1) (2026-08-09)


### Bug Fixes

* keep runners off fast roads, and report ascent that matches the exported GPX ([8f9aa15](https://github.com/kasperiio/looply/commit/8f9aa15a8b06961b8761e323bb6f952f27b82353))
* **routing:** keep runners off fast roads and unmarked singletrack ([fcec226](https://github.com/kasperiio/looply/commit/fcec2260bc3d0fb8225f2419c62cf16af0f88b35))
* **stats:** compute ascent from the exported track ([1a50b2f](https://github.com/kasperiio/looply/commit/1a50b2f68318b26227f6787bfa1bce5351f348be))

## [1.6.0](https://github.com/kasperiio/looply/compare/v1.5.0...v1.6.0) (2026-08-07)


### Features

* **routing:** avoid private-ish ways, stay on public roads and paths ([80b7d57](https://github.com/kasperiio/looply/commit/80b7d57921772dca0d500e0fd379a58434811f1b))
* **routing:** avoid private-ish ways, stay on public roads and paths ([79e8c8f](https://github.com/kasperiio/looply/commit/79e8c8fb1ad905f8b256c618a4d26d62867e7040))

## [1.5.0](https://github.com/kasperiio/looply/compare/v1.4.0...v1.5.0) (2026-08-07)


### Features

* **search:** compact address labels and address-only results ([8deba6b](https://github.com/kasperiio/looply/commit/8deba6b02544c317bad0cf7eb3c8c43c60b12102))
* **search:** compact address labels and address-only results ([c4527e3](https://github.com/kasperiio/looply/commit/c4527e3bc9357690425cfafe9bf5a13b870367e5))

## [1.4.0](https://github.com/kasperiio/looply/compare/v1.3.0...v1.4.0) (2026-08-06)


### Features

* **ux:** cycling disciplines, route actions in stats bar, contextual tips, faster generation ([e55b1a3](https://github.com/kasperiio/looply/commit/e55b1a3e1cae0d9539d0af8c68aaca5fd737532d))


### Bug Fixes

* **app:** keep alternatives on manual route edit; ci: exponentially faster release builds ([dc33780](https://github.com/kasperiio/looply/commit/dc337802444ab383c6dd6b74f3f5ae9c5abe1a03))
* **app:** keep route alternatives when editing a route manually ([d23c1c4](https://github.com/kasperiio/looply/commit/d23c1c4c3808e5bc576a8f65ddbe7fed3408f0f9))

## [1.3.0](https://github.com/kasperiio/looply/compare/v1.2.0...v1.3.0) (2026-08-06)


### Features

* **routing:** enforce sidebar criteria via custom BRouter profiles and overhaul route quality ([c85861c](https://github.com/kasperiio/looply/commit/c85861c4ba7ff7cb02bf756143c3d13e9d8d7dd9))
* **routing:** enforce sidebar criteria via custom BRouter profiles and overhaul route quality ([6b53596](https://github.com/kasperiio/looply/commit/6b5359662e51cf098dc338f61696f30e8cd83ea6))
* **routing:** parallelize candidate search and add tunable road aversion ([2fe7b73](https://github.com/kasperiio/looply/commit/2fe7b73a4c3d64e05cf265e8dcd9c687813b3c17))
* **ux:** cycling disciplines, route actions in stats bar, contextual tips, faster generation ([095bd0c](https://github.com/kasperiio/looply/commit/095bd0c181eb2d1cbc3fe2020f38a1f0c7085ef9))
* **ux:** cycling disciplines, route actions in stats bar, contextual tips, faster generation ([e55b1a3](https://github.com/kasperiio/looply/commit/e55b1a3e1cae0d9539d0af8c68aaca5fd737532d))

## [1.2.0](https://github.com/kasperiio/looply/compare/v1.1.0...v1.2.0) (2026-05-26)


### Features

* **seo:** add google adsense ads.txt entry ([ae20ad6](https://github.com/kasperiio/looply/commit/ae20ad6fa1fc17d9a09c55cfae6aff025d100e4c))

## [1.1.0](https://github.com/kasperiio/looply/compare/v1.0.0...v1.1.0) (2026-05-26)


### Features

* map overlay hints ([5dddcf8](https://github.com/kasperiio/looply/commit/5dddcf8ef29da6aef5ef7c5f2bda92a780a80e1b))

## 1.0.0 (2026-05-26)


### Features

* include version information ([194d917](https://github.com/kasperiio/looply/commit/194d91723c5d80822096ed27936272b4bb52984d))
* Initial release ([7e7ef36](https://github.com/kasperiio/looply/commit/7e7ef3665f21d6ab1078f6526e5ec113b64b46cd))

## Changelog

All notable changes to this project are documented in this file.

Release versioning is managed by [release-please](https://github.com/googleapis/release-please).
