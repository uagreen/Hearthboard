# Віджети Synology: здоров'я дисків, томи, оновлення DSM, мережа, завантаження

Дата: 2026-11-27. Статус: **схвалено автором**.

## Навіщо

Віджети `diskstation` і `downloadstation` показують мало. Автор хоче бачити стан дисків і RAID, усі томи, температуру, версію й потребу в оновленні DSM, швидкість мережі, кількість підключених користувачів та список завантажень із прогрес-барами.

## Цілі

1. `diskstation`, нові поля (вимкнені за замовчуванням, вибираються через `fields`): `temperature`, `firmware`, `update`, `diskHealth`, `networkDown`, `networkUp`, `users`. Стандартні `uptime`, `volumeAvailable`, `resources.cpu`, `resources.mem` не змінюються.
2. Акордіон `showVolumes`: усі томи, смужка заповнення, статус. Акордіон `showDisks`: кожен диск (назва, модель, температура, стан). Опція `expandSections`.
3. `downloadstation`: опції `showDownloads`, `downloadsCount` (1-20, за замовчуванням 5), `expandSections`; акордіон із назвою, смужкою прогресу, швидкістю, статусом.
4. Спільний компонент смужки прогресу `ProgressRow`; Transmission переходить на нього без зміни поведінки.

## Не цілі

Розміри спільних папок (надійного API немає: квота не дорівнює обсягу), дисковий I/O (форму відповіді не знайдено), Photos/Surveillance Station, керування NAS.

## Анти-цілі

- Зміна наявних конфігів чи додаткові запити для них: нові endpoint-и викликаються лише коли потрібні вибраним полям/акордіонам.
- Падіння, коли права облікового запису не дозволяють метод або структура відповіді інша: значення «—», решта віджета працює.
- Витік пароля в браузер.

## Перевірені факти (код `mib1185/py-synologydsm-api`, `N4S4/synology-api`)

- `SYNO.Storage.CGI.Storage` `load_info` → `data.disks[]` (`id`, `name`, `model`, `status`, `smart_status`, `temp`, `size_total`), `data.volumes[]` (`id`, `status`, `fs_type`, `size.total`, `size.used` рядками).
- `SYNO.Core.System` `info` → `sys_temp`, `firmware_ver`, `model`, `up_time`.
- `SYNO.Core.System.Utilization` `get` → `network[]` із записом `device == "total"`, поля `rx` (вниз) і `tx` (вгору).
- `SYNO.Core.Upgrade.Server` `check` → `data.update ?? data`: `available`, `version`.
- **Не підтверджено:** `SYNO.Core.CurrentConnection` `get` існує, але ключі відповіді невідомі; значення статусів дисків (`normal`, …) і поля `title`/`status` завдань Download Station взято з пам'яті про DSM.

## Мої рішення

1. Користувачі: `total ?? items.length`, інакше `null` («—»). Позначено неперевіреним у документації.
2. `diskHealth`: рахуємо диски зі `status` або `smart_status` не `normal` та томи зі `status` не `normal`; 0 → «OK», інакше «N issues».
3. Завдання Download Station у списку: статус `downloading` та `error`; помилкові першими, далі за швидкістю.
4. Endpoint-и `storage_info`, `upgrade`, `connections` викликаються лише при відповідних полях/акордіонах (endpoint `""` вимикає запит у `useWidgetAPI`).
5. Наявний тест `diskstation` мокає хуки послідовністю; його переводимо на мок за endpoint.
6. Для `downloadstation` власна копія `clampCount` (не імпортуємо з віджета Transmission).

## Перевірка

Юніт-тести на фікстурах. На живому NAS не перевірялося.
