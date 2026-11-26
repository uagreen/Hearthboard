---
title: Built-in Editor
description: Editing the Homepage configuration in the browser (Hearthboard fork)
icon: material/pencil
---

!!! note

    The editor exists only in the Hearthboard fork of Homepage. It is based on [homepage-editor](https://github.com/jchisholm59/homepage-editor) (MIT, see `NOTICE`). It is **disabled by default**.

The editor is a page of the dashboard itself, served at `/editor` by the same process and container as Homepage. It reads and writes the files in your config directory (`services.yaml`, `settings.yaml`, `bookmarks.yaml`, `widgets.yaml`, `docker.yaml`, `kubernetes.yaml`, `proxmox.yaml`, `custom.css`, `custom.js`) and has a Settings tab, a widget catalog and a link checker built from this version's own documentation.

Every save keeps your comments and key order, makes a backup of the previous file, refuses to overwrite a file that changed on disk after you opened it, and refreshes the dashboard right away.

## Enabling

Set `HOMEPAGE_EDITOR=true` and **protect the editor**, because it can change files that contain API keys and can add custom JavaScript to your dashboard.

```yaml
services:
  homepage:
    image: ghcr.io/uagreen/hearthboard:latest
    environment:
      HOMEPAGE_EDITOR: "true"
      EDITOR_PASSWORD: "choose-a-long-password"
      HOMEPAGE_ALLOWED_HOSTS: "homepage.example.com"
    volumes:
      - ./config:/app/config
```

Then open `https://homepage.example.com/editor`.

## Access rules

The first rule that applies wins:

1. The request's `Host` must be allowed (`HOMEPAGE_ALLOWED_HOSTS`), as for the rest of Homepage.
2. If [Homepage authentication](settings.md) is enabled, the Homepage login is required (`401` otherwise) and the editor then needs only `HOMEPAGE_EDITOR=true`.
3. Without `HOMEPAGE_EDITOR=true` every `/api/editor/*` route answers `404`.
4. Otherwise `EDITOR_PASSWORD` is required (HTTP Basic authentication; the user name is ignored).
5. With neither Homepage authentication nor `EDITOR_PASSWORD`, the editor answers `403` and says what to set, unless you explicitly opt out with `EDITOR_ALLOW_NO_AUTH=true`.

!!! warning

    Use `EDITOR_ALLOW_NO_AUTH=true` only on a network you fully trust (for example, behind a VPN or an authenticating reverse proxy). Anyone who can reach `/editor` can read your configuration, including secrets, and change it. Basic authentication sends the password with every request, so serve the editor over HTTPS.

## Environment variables

| Variable               | Default                    | Meaning                                                                                                                                         |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOMEPAGE_EDITOR`      | unset                      | Set to `true` to enable the editor. Anything else leaves it off.                                                                                |
| `EDITOR_PASSWORD`      | unset                      | Password for HTTP Basic authentication when Homepage authentication is off.                                                                     |
| `EDITOR_ALLOW_NO_AUTH` | unset                      | Set to `true` to allow the editor with no authentication at all.                                                                                |
| `EDITOR_BACKUP_DIR`    | `<config>/.editor-backups` | Where backups are kept. The default lives in your config volume, so backups survive re-creating the container. The 300 newest backups are kept. |
| `DOCKER_PROXY`         | unset                      | URL of a Docker API proxy; enables the "Restart Homepage" button, needed to make new icons and backgrounds appear.                              |
| `HOMEPAGE_CONTAINER`   | `homepage`                 | Name of the container to restart through `DOCKER_PROXY`.                                                                                        |

For the restart button, point `DOCKER_PROXY` at a [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) that allows only restarts (`POST=1`, `CONTAINERS=1`, `ALLOW_RESTARTS=1`). Do not give the editor the raw Docker socket.

## Security notes

- Remote requests made for you (icon download, link checker) accept only `http` and `https`. Icon download also refuses loopback, link-local and `0.0.0.0` addresses and re-checks every redirect. The link checker deliberately allows private LAN addresses, because its purpose is checking your own services. A DNS answer could still change between the check and the request.
- Uploaded and downloaded icons are served with a `sandbox` content security policy, so an SVG cannot run scripts.
- Only the files listed above in the config directory can be read or written, and request bodies are limited to 2 MB.
- `custom.js` runs in every visitor's browser. Treat write access to the editor as write access to the dashboard.

## Developing

`pnpm dev` and `pnpm build` first generate the widget/settings catalog and copy the front-end libraries into `public/editor/` (`pnpm editor:assets`). Those generated files are not committed. End-to-end tests run with `pnpm test:e2e` (Playwright, Chromium).
