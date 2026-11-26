---
title: Transmission
description: Transmission Widget Configuration
---

Learn more about [Transmission](https://github.com/transmission/transmission).

Uses the same username and password used to login from the web.

Allowed fields: `["leech", "download", "seed", "upload", "queued", "paused", "errored"]`. By default the first four are shown.

- `queued`: torrents waiting in the download or seed queue.
- `paused`: stopped torrents.
- `errored`: torrents with a tracker or local error.

```yaml
widget:
  type: transmission
  url: http://transmission.host.or.ip
  username: username
  password: password
  rpcUrl: /transmission/ # Optional. Matches the value of "rpc-url" in your Transmission's settings.json file
  fields: ["leech", "download", "queued", "errored"] # Optional
  showDownloads: true # Optional, default: false. Collapsible list of downloads with progress bars
  downloadsCount: 5 # Optional, 1-20, default: 5. Rows in the list
  expandSections: false # Optional, default: false. Open the list by default
```

## Downloads list

With `showDownloads` the widget adds a collapsible "Downloads" list. Each row shows the torrent name, a progress bar with the percentage, the download speed, the estimated time left and the size. Torrents that are downloading are listed, fastest first. Torrents with an error (and not finished) are listed first, with a red bar and the error text from Transmission.

The extra data is requested in the same `torrent-get` call as the counters, and only when `showDownloads` is enabled. The estimated time and progress are as reported by Transmission.
