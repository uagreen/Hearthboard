---
title: OpenWRT
description: OpenWRT widget configuration
---

Learn more about [OpenWRT](https://openwrt.org/).

Provides information from OpenWRT

Allowed fields:

- System mode (no `interfaceName`): `["uptime", "cpuLoad", "clients", "update"]`. By default `uptime` and `cpuLoad` are shown.
- Interface mode: `["widget.status", "bytesTx", "bytesRx", "rxRate", "txRate"]`. By default the first three are shown.

```yaml
widget:
  type: openwrt
  url: http://host.or.ip
  username: homepage
  password: pass
  fields: ["uptime", "cpuLoad", "clients", "update"] # optional
  checkUpdates: true # optional, default true. Set to false to never contact downloads.openwrt.org
```

WAN speed, using the WAN device name (for example `eth1`, see `ubus call network.device status`):

```yaml
widget:
  type: openwrt
  url: http://host.or.ip
  username: homepage
  password: pass
  interfaceName: eth1
  fields: ["widget.status", "rxRate", "txRate"]
```

## Interface

Setting `interfaceName` (e.g. eth0) will display information for that particular device, otherwise the widget will display general system info.

`rxRate` (download) and `txRate` (upload) are the current speeds in bytes per second. They are calculated from the difference between two polls, so the first value after starting Homepage (or after the router restarts) shows `—`.

## Clients

`clients` is the number of active DHCP leases (IPv4). Devices with a static IP that do not use DHCP are not counted. It needs the `luci-rpc` ubus object (installed with LuCI) and the ACL entry below; without it the value shows `—`.

## Firmware update

`update` compares the installed OpenWrt version with the list of releases at `https://downloads.openwrt.org/.versions.json`. The list is fetched by the Homepage server (not your browser), cached for 12 hours, and the request does not contain any information about your router.

- `Up to date`: no newer release.
- `Update: 24.10.8`: a newer release exists in your release series.
- `New series 25.12.6`: you are on the latest release of your series and a newer series is available.
- `Unknown`: snapshot or release-candidate builds, a series that is no longer listed, or the list could not be fetched.

Updates of individual packages are not checked. Set `checkUpdates: false` to disable the request.

## Authorization

In order for homepage to access the OpenWRT RPC endpoints you will need to [create an ACL](https://openwrt.org/docs/techref/ubus#acls) and [new user](https://openwrt.org/docs/techref/ubus#authentication) in OpenWRT.

Create an ACL named `homepage.json` in `/usr/share/rpcd/acl.d/`, the following permissions will suffice (`system.board` is needed for `update`, `luci-rpc` for `clients`):

```json
{
  "homepage": {
    "description": "Homepage widget",
    "read": {
      "ubus": {
        "network.interface.wan": ["status"],
        "network.interface.lan": ["status"],
        "network.device": ["status"],
        "system": ["info", "board"],
        "luci-rpc": ["getDHCPLeases"]
      }
    }
  }
}
```

Create a `crypt(5)` password hash using the following command in the OpenWRT shell:

```sh
uhttpd -m "<somepassphrase>"
```

Then add a user that will use the ACL and hashed password in `/etc/config/rpcd`:

```
config login
        option username 'homepage'
        option password '<hashedpassword>'
        list read homepage
```

This username and password will be used in Homepage's services.yaml to grant access.
