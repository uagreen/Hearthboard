---
title: Synology Download Station
description: Synology Download Station Widget Configuration
---

Learn more about [Synology Download Station](https://www.synology.com/en-us/dsm/packages/DownloadStation).

Note: the widget is not compatible with 2FA.

Allowed fields: `["leech", "download", "seed", "upload"]`.

```yaml
widget:
  type: downloadstation
  url: http://downloadstation.host.or.ip:port
  username: username
  password: password
  showDownloads: true # Optional, default: false. Collapsible list of downloads with progress bars
  downloadsCount: 5 # Optional, 1-20, default: 5. Rows in the list
  expandSections: false # Optional, default: false. Open the list by default
```

## Downloads list

With `showDownloads` the widget adds a collapsible "Downloads" list. Each row shows the task title, a progress bar with the percentage and the download speed. Tasks that are downloading are listed, fastest first. Tasks in an error state are listed first with a red bar.

The data comes from the same task list request as the counters. The task `title` and `status` handling follows the Download Station API; it was not tested against a live NAS.
