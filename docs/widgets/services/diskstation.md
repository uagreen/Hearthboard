---
title: Synology Disk Station
description: Synology Disk Station Widget Configuration
---

Learn more about [Synology Disk Station](https://www.synology.com/en-global/dsm).

Note: the widget is not compatible with 2FA.

An optional 'volume' parameter can be supplied to specify which volume's free space to display when more than one volume exists. The value of the parameter must be in form of `volume_N`, e.g. to display free space for volume2, `volume_2` should be set as 'volume' value. If omitted, first returned volume's free space will be shown (not guaranteed to be volume1).

Allowed fields: `["uptime", "volumeAvailable", "resources.cpu", "resources.mem", "temperature", "firmware", "update", "diskHealth", "networkDown", "networkUp", "users"]`. By default the first four are shown.

- `temperature`: system temperature.
- `firmware`: the installed DSM version.
- `update`: whether a DSM update is available (`Up to date`, `Update: <version>` or `Unknown`).
- `diskHealth`: `OK`, or the number of disks and volumes whose status (or S.M.A.R.T. status) is not `normal`.
- `networkDown` and `networkUp`: the current total network speed.
- `users`: the number of current connections.

Optional lists:

- `showVolumes`: a collapsible list of all volumes with a fill bar and the volume status.
- `showDisks`: a collapsible list of all disks with the model, the temperature and the status.
- `expandSections`: open the lists by default.

The extra data is requested only when a field or list needs it, so existing configs send the same requests as before. If one of the optional requests is not allowed for the account or fails, only its value shows `—`.

Not available: sizes of shared folders and disk I/O.

To access these system metrics you need to connect to the DiskStation (`DSM`) with an account that is a member of the default `Administrators` group. That is because these metrics are requested from the API's `SYNO.Core.System` part that is only available to admin users. In order to keep the security impact as small as possible we can set the account in DSM up to limit the user's permissions inside the Synology system. In DSM 7.x, for instance, follow these steps:

1. Create a new user, i.e. `remote_stats`.
2. Set up a strong password for the new user
3. Under the `User Groups` tab of the user config dialogue check the box for `Administrators`.
4. On the `Permissions` tab check the top box for `No Access`, effectively prohibiting the user from accessing anything in the shared folders.
5. Under `Applications` check the box next to `Deny` in the header to explicitly prohibit login to all applications.
6. Now _only_ allow login to the `DSM` and `Download Station` applications, either by
   - unchecking `Deny` in the respective row, or (if inheriting permission doesn't work because of other group settings)
   - checking `Allow` for this app, or
   - checking `By IP` for this app to limit the source of login attempts to one or more IP addresses/subnets.
7. When the `Preview` column shows `Allow` in the `DSM` row, click `Save`.

Now configure the widget with the correct login information and test it.

If you encounter issues during testing:

1. Make sure to uncheck the option for automatic blocking due to invalid logins under `Control Panel > Security > Protection`.
   - If desired, this setting can be reactivated once the login is established working.
2. Login to your Synology DSM with the newly created account and accept terms and conditions.
3. Reattempt

```yaml
widget:
  type: diskstation
  url: http://diskstation.host.or.ip:port
  username: username
  password: password
  volume: volume_N # optional
  fields: ["uptime", "volumeAvailable", "temperature", "diskHealth", "update"] # optional
  showVolumes: false # optional, default: false
  showDisks: false # optional, default: false
  expandSections: false # optional, default: false
```

The new values were built from the DSM API as used by open-source clients and covered by unit tests, but **not tested against a live NAS**. In particular the response of the current-connections request (`users`) and the exact status values of disks and volumes are unverified.
