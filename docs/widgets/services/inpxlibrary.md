---
title: INPX Library
description: INPX Library Server Widget Configuration
---

!!! note

    This widget exists only in the Hearthboard fork.

Learn more about [inpx-library-server](https://github.com/Habsaec/inpx-library-server).

The widget shows library counters and the indexing status without any login. Optionally it shows what a library user is reading, wants to read and the latest books of one of their shelves; that needs the library user's own username and password.

Allowed fields: `["books", "authors", "series", "genres", "languages"]`.

```yaml
widget:
  type: inpxlibrary
  url: http://library.host.or.ip:3000
  fields: ["books", "authors", "series", "genres"] # optional
  showIndexing: true # optional, defaults to true
  username: reader # optional, needed for the lists below
  password: your-password # optional, needed for the lists below
  showReading: true # optional, defaults to false
  showWant: true # optional, defaults to false
  shelf: Favorites # optional, name of one of the user's shelves
  count: 10 # optional, 1-10, defaults to 10
  expandSections: false # optional, defaults to false
```

| Option                 | Default                                    | Meaning                                                                                                 |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `fields`               | `["books", "authors", "series", "genres"]` | Counters to show (up to 5).                                                                             |
| `showIndexing`         | `true`                                     | A line with indexing progress while the library is indexing, otherwise the time of the last index.      |
| `username`, `password` | none                                       | The library user's own login. Used only on the Homepage server (HTTP Basic), never sent to the browser. |
| `showReading`          | `false`                                    | Collapsible list of books the user is reading.                                                          |
| `showWant`             | `false`                                    | Collapsible list of books the user wants to read.                                                       |
| `shelf`                | none                                       | Name of one of the user's shelves (case does not matter); its latest books are listed.                  |
| `count`                | `10`                                       | Books per list (1-10).                                                                                  |
| `expandSections`       | `false`                                    | Open the lists by default.                                                                              |

Things to know:

- Set `href` on the service to the address your **browser** uses to reach the library. Book links and covers are built from it; without it the lists have titles only.
- Covers are loaded by the browser straight from the library, so they show only if the library allows anonymous browsing or you are signed in to it in the same browser. Otherwise only titles and authors are shown.
- The lists use the library user's own login. The library server limits repeated failed logins, so a wrong password can lock that account for a while. After an error the widget stops polling and shows a hint.
- Counters are cached by the library server for about ten minutes, so they can lag behind.
- The widget was written against the source code of inpx-library-server; it has not been tested against every version of it.
