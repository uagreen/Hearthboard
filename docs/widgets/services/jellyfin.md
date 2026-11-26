---
title: Jellyfin
description: Jellyfin Widget Configuration
---

Learn more about [Jellyfin](https://github.com/jellyfin/jellyfin).

You can create an API key from inside the Jellyfin Administration Dashboard under `Advanced > API Keys`.

By default blocks are disabled and 'Now Playing' is enabled. You can toggle these settings using the enableBlocks and enableNowPlaying options.

Allowed fields: `["movies", "series", "episodes", "songs", "albums"]`.

| Jellyfin Version | Homepage Widget Version |
| ---------------- | ----------------------- |
| < 12 (10.12)     | 1 (default)             |
| >= 12            | 2                       |

```yaml
widget:
  type: jellyfin
  url: http://jellyfin.host.or.ip:port
  key: apikeyapikeyapikeyapikeyapikey
  version: 2 # optional, default is 1
  enableBlocks: true # optional, defaults to false
  enableNowPlaying: true # optional, defaults to true
  enableUser: true # optional, defaults to false
  enableMediaControl: false # optional, defaults to true
  showEpisodeNumber: true # optional, defaults to false
  expandOneStreamToTwoRows: false # optional, defaults to true
  showLibraries: true # optional, defaults to false
  showContinueWatching: true # optional, defaults to false
  showLatest: true # optional, defaults to false
  latestCount: 5 # optional, 1-10, defaults to 5
  continueCount: 5 # optional, 1-10, defaults to 5
  user: anna # optional, user shown first, defaults to the first user
  enableUserSwitch: true # optional, defaults to true
  expandSections: false # optional, defaults to false
```

## Libraries, continue watching and recently added

!!! note

    These sections exist only in the Hearthboard fork. All of them are off by default.

| Option                 | Default    | Meaning                                                                                                          |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `showLibraries`        | `false`    | Links to the libraries of the selected user.                                                                     |
| `showContinueWatching` | `false`    | Collapsible list of series episodes the selected user has started, with poster, title, rating and a link.        |
| `showLatest`           | `false`    | One collapsible list per library with the most recently added items, each with poster, title, rating and a link. |
| `latestCount`          | `5`        | Items per library (1-10).                                                                                        |
| `continueCount`        | `5`        | Episodes under "continue watching" (1-10).                                                                       |
| `user`                 | first user | Name of the user whose lists are shown until a viewer picks another one.                                         |
| `enableUserSwitch`     | `true`     | Show a user selector on the dashboard. The choice is remembered in the browser.                                  |
| `expandSections`       | `false`    | Open the collapsible lists by default.                                                                           |

Requirements and things to know:

- Set `href` on the service. Links and posters are built from it, so it must be the address your **browser** uses to reach Jellyfin (it may differ from the widget `url`). Without `href` the lists still work, but have no links or posters.
- Posters are loaded by the browser straight from Jellyfin (`/Items/<id>/Images/Primary`), which serves images without authentication. The API key is never sent to the browser.
- The user list comes from `/Users`, which needs an API key with administrator rights. If it is unavailable, the sections show a hint instead of the lists.
- Anyone who can see the dashboard can switch to any user and see what that user is watching. Do not enable these sections on a dashboard that is exposed to people who should not see this.
- The rating is Jellyfin's `CommunityRating` (shown as `★ 7.8`). Its source depends on the metadata providers you use in Jellyfin; it is not necessarily IMDb.
- The sections use the `UserViews`, `Items/Latest` and `UserItems/Resume` API routes, which Jellyfin 12.x has. They work the same with `version: 1` and `version: 2`, but older servers without these routes will not show them.

## Troubleshooting Jellyfin 12

Jellyfin 12 removed the old `/emby/...` routes and `api_key` authentication, so `version: 2` is required (the default, `1`, will fail). If the widget still shows an error with `version: 2`, check the container log for a line like `HTTP Error 401 calling http://...` and open an issue with it, together with the Jellyfin server version.
