# Kontrol — FR & NFR v1

## Document Info
- Version: 1.1
- Date: 2026-06-19
- Status: Draft
- Owner: (продуктовласник / solo-developer)
- Scope: MVP (v1)
- Changelog: v1.1 — стек змінено на повний TypeScript/Next.js на Vercel + serverless-Postgres (раніше DRF + React + Azure).

## 1. Context

**Kontrol** — веб-сервіс для дисциплінованого контролю харчування з ціллю набору ваги, плюс трекінг прогресу (вага, заміри тіла) і допоміжні модулі (список покупок, інтеграція з Telegram). Продукт переноситься з прототипу (single-user застосунок, дані в одному JSON-блобі) у повноцінний multi-user SaaS на стеку **DRF + React**, хостинг **Azure**.

Цільова аудиторія v1 — продуктовласник та невелике коло знайомих зі схожою задачею (здоровий набір ваги через режим харчування й трекінг). Це не комерційний продукт на цьому етапі: без billing, без команд/ролей. Проте архітектура й data-модель проектуються multi-tenant з першого дня, щоб подальше відкриття для ширшої аудиторії («далі як піде») не вимагало переписування.

Технічний стек: **повний TypeScript на Next.js (фронт + бек) з деплоєм на Vercel**, БД — **serverless-Postgres** (провайдер TBD, за пулінгом), ORM — Prisma або Drizzle, auth — Auth.js.

Ці вимоги описують **MVP (v1)** і відповідають принципу parity з поточним функціоналом прототипу плюс акаунти. Продукт **не є медичною порадою**; орієнтований на здоровий набір ваги, з UX-принципом «floors-not-ceilings» (немає поняття «провального дня»).

## 2. Functional Requirements

| ID     | Module        | Requirement | Priority | Source | AC ref |
|--------|---------------|-------------|----------|--------|--------|
| FR-001 | accounts | Користувач реєструється за email + password. | Must | Multi-user constraint | US-AC-01 |
| FR-002 | accounts | Користувач логіниться за email + password. | Must | Multi-user constraint | US-AC-02 |
| FR-003 | accounts | Користувач скидає пароль через email. | Should | Базова гігієна auth | US-AC-03 |
| FR-004 | accounts | Користувач автентифікується через OAuth Google. | Could | Зручність | US-AC-04 |
| FR-005 | accounts | Користувач редагує профіль: зріст, вік, kcal floor, kcal target, timezone. | Must | Інтерв'ю: персоналізація цілей | US-AC-05 |
| FR-006 | accounts | Користувач експортує всі свої дані одним запитом. | Should | GDPR-light | US-AC-06 |
| FR-007 | accounts | Користувач видаляє акаунт разом з усіма даними. | Should | GDPR-light | US-AC-07 |
| FR-010 | nutrition | Користувач налаштовує слоти прийомів їжі: кількість, назва, час, target_kcal. | Must | Інтерв'ю: «засетапити кількість прийомів і час» | US-NU-01 |
| FR-011 | nutrition | Користувач бачить екран «Today» з прийомами на поточну дату та поточними стравами. | Must | Parity | US-NU-02 |
| FR-012 | nutrition | Система авто-ротує варіанти страв по днях, зміщуючи їх між слотами. | Must | Parity | US-NU-03 |
| FR-013 | nutrition | Користувач позначає прийом виконаним / знімає позначку. | Must | Parity | US-NU-04 |
| FR-014 | nutrition | Система рахує денні калорії та показує їх відносно floor і target. | Must | Parity | US-NU-05 |
| FR-015 | nutrition | Користувач замінює прийом на «мінімум» (шейк) як полегшену опцію. | Should | UX: floors-not-ceilings | US-NU-06 |
| FR-016 | nutrition | Користувач відкриває детальний рецепт страви (ingredients + steps + час). | Must | Parity | US-NU-07 |
| FR-017 | nutrition | Користувач регенерує страву слота через AI з тією ж калорійністю (±40) і доречну прийому. | Should | Parity (AI-фіча) | US-NU-08 |
| FR-018 | nutrition | Користувач вмикає режим «з наявних продуктів» — регенерація з позицій списку покупок. | Could | Інтерв'ю: синхронізація | US-NU-09 |
| FR-019 | nutrition | Користувач відкочує слот до початкової (rotation) страви. | Should | Parity | US-NU-10 |
| FR-020 | nutrition | Система зберігає override страви на конкретну дату (не змінюючи майбутні дні). | Must | Підтримка FR-017/018/019 | US-NU-11 |
| FR-030 | purchase | Користувач бачить активний список покупок зі staple-категоріями. | Must | Parity | US-PU-01 |
| FR-031 | purchase | Користувач позначає позицію як «куплено». | Must | Parity | US-PU-02 |
| FR-032 | purchase | Інгредієнти змінених (override) страв синхронізуються в активний список. | Should | Інтерв'ю: синхронізація | US-PU-03 |
| FR-033 | purchase | Користувач закриває поточний список і відкриває новий похід (snapshot). | Must | Інтерв'ю: версіонування-снапшот | US-PU-04 |
| FR-034 | purchase | Користувач порівнює активний список із попереднім походом. | Should | Інтерв'ю: «що купував минулого разу» | US-PU-05 |
| FR-035 | purchase | Користувач надсилає активний список покупок у Telegram. | Should | Parity | US-PU-06 |
| FR-040 | progress | Користувач записує вагу з прив'язкою до дати (append-only). | Must | Parity | US-PR-01 |
| FR-041 | progress | Користувач бачить тренд ваги та дельти між записами. | Must | Parity | US-PR-02 |
| FR-042 | progress | Користувач записує заміри тіла: рука, груди, стегно, талія. | Should | Parity | US-PR-03 |
| FR-043 | progress | Користувач бачить дельти замірів між послідовними записами. | Should | Інтерв'ю: «різниця між записами» | US-PR-04 |
| FR-044 | progress | Система рахує серію днів (streak) на основі виконання денного мінімуму. | Should | Parity | US-PR-05 |
| FR-045 | progress | Користувач бачить 7-денний огляд виконання. | Could | Parity | US-PR-06 |
| FR-050 | notifications | Користувач прив'язує Telegram-акаунт через deep-link token (без ручного вставлення токена). | Should | SaaS-вимога до Telegram | US-NT-01 |
| FR-060 | migration | Продуктовласник одноразово імпортує існуючі дані прототипу з JSON-блоба. | Could | Перенесення власних даних | US-MG-01 |

## 3. Non-Functional Requirements

### Performance
| ID | Aspect | Requirement (measurable) | Priority |
|----|--------|--------------------------|----------|
| NFR-P-01 | Page load | Екран «Today» інтерактивний (TTI) ≤ 1.5s (p95) на broadband. | Must |
| NFR-P-02 | Autosave | Позначка/перемикання персиститься ≤ 500ms (p95) після дії. | Must |
| NFR-P-03 | AI regenerate | Регенерація страви end-to-end ≤ 6s (p95); за перевищення — graceful fallback на готовий варіант. | Should |

### Scalability
| ID | Aspect | Requirement | Priority |
|----|--------|-------------|----------|
| NFR-S-01 | Load | Система тримає до 50 зареєстрованих / 10 concurrent користувачів без порушення NFR-P. | Must |
| NFR-S-02 | Multi-tenancy | Кожен рядок даних прив'язаний до користувача; cross-user доступ неможливий на рівні запитів. | Must |

### Availability & Reliability
| ID | Aspect | Requirement | Priority |
|----|--------|-------------|----------|
| NFR-A-01 | Uptime | Best-effort, без SLA; плановий downtime припустимий із попередженням. | Must |
| NFR-A-02 | Backups | Щоденний автоматичний бекап БД; RPO ≤ 24h, RTO ≤ 24h. | Should |

### Security & Privacy
| ID | Aspect | Requirement | Priority |
|----|--------|-------------|----------|
| NFR-SEC-01 | Transport | Весь трафік — TLS 1.2+. | Must |
| NFR-SEC-02 | At-rest | Дані в БД зашифровані at-rest; ключі керовані провайдером БД (managed keys). | Must |
| NFR-SEC-03 | Auth | Паролі хешуються (Argon2/PBKDF2); сесія через захищені токени. | Must |
| NFR-SEC-04 | Isolation | Per-user ізоляція даних enforced на query-рівні (не лише в UI). | Must |
| NFR-SEC-05 | AI keys | Ключі AI-провайдера лише server-side, ніколи в клієнті. | Must |
| NFR-SEC-06 | Data rights | Export + повне видалення даних за запитом користувача (GDPR-light). | Should |
| NFR-SEC-07 | Health data | Жодної сторонньої аналітики/реклами поверх health-даних; регіон зберігання — EU. | Should |

### Usability
| ID | Aspect | Requirement | Priority |
|----|--------|-------------|----------|
| NFR-U-01 | Mobile-first | Ключові екрани адаптивні, оптимізовані під мобільний браузер. | Must |
| NFR-U-02 | Browser matrix | Останні 2 major-версії Chrome, Safari, Firefox, Edge. | Must |
| NFR-U-03 | Language | UI українською. EN — поза v1. | Must |
| NFR-U-04 | Wellbeing UX | UI не вживає «провальних» формулювань; модель floors-not-ceilings; вага — щотижня, не щодня. | Should |
| NFR-U-05 | Disclaimer | Видимий дисклеймер: продукт не є медичною порадою. | Should |

### Observability
| ID | Aspect | Requirement | Priority |
|----|--------|-------------|----------|
| NFR-O-01 | Logging | Structured logs з correlation-id на кожен запит. | Should |
| NFR-O-02 | Error tracking | Error-tracking (Sentry free tier або аналог) з alert при підвищеному 5xx-rate. | Could |

### Cost
| ID | Aspect | Requirement | Priority |
|----|--------|-------------|----------|
| NFR-C-01 | Infra | На приватному масштабі — Vercel Hobby (free) + serverless-Postgres (free/стартовий тариф); ціль ≤ $25/міс при виході за безкоштовні ліміти. | Should |
| NFR-C-02 | AI cost | Квота регенерацій per user (напр. ~20/день); середній кошт однієї регенерації ≤ $0.02. | Should |

## 4. Out of Scope (v1)

- **Billing / підписки / монетизація** — продукт некомерційний на v1.
- **Команди, ролі, організації, sharing** — лише одиночні акаунти.
- **Real-time collaboration** — не застосовно.
- **Модуль gym** (план тренувань, сесії, «тренувався сьогодні») — відкладено на Phase 2 за рішенням продуктовласника.
- **Повна GDPR/compliance-програма** — зараз лише export + delete (GDPR-light).
- **EN-локалізація та i18n даних** — пізніше.
- **Native mobile apps** — лише web/PWA.
- **WCAG AA повністю** — best-effort, без формального таргету в v1.
- **ED-safety guardrails для широкої аудиторії** — вмикаємо при відкритті для публіки, не в приватному колі.

## 5. Assumptions & Dependencies

- **AI-провайдер:** Anthropic API; ключ і кошт несе продуктовласник.
- **Telegram Bot API** — для прив'язки акаунта й надсилання списків (через webhook, не long-polling).
- **Хостинг:** Vercel (Next.js, повний TypeScript — фронт + бек через route handlers / server actions).
- **БД:** serverless-Postgres (Neon / Supabase / Vercel Postgres — провайдер TBD), за пулінгом; абстрагована за ORM (Prisma або Drizzle).
- **Auth:** Auth.js (email+password, опційно OAuth).
- **Команда:** один розробник, без дедлайну.
- **Міграція:** існуючі дані прототипу переносяться одноразово з JSON-блоба.
- **Юридичне:** контент рецептів — власний/згенерований; продукт не позиціонується як медичний.

## 6. Open Questions

| # | Питання | Owner |
|---|---------|-------|
| OQ-1 | Вибір serverless-Postgres провайдера: Neon / Supabase / Vercel Postgres (абстраговано за ORM, тож рішення оборотне). | Продуктовласник / tech |
| OQ-2 | OAuth Google у v1 чи лише email+password? | Продуктовласник |
| OQ-3 | Коли стартує модуль gym (Phase 2) і в якому обсязі? | Продуктовласник |
| OQ-4 | Чи знадобиться EN-локалізація, і коли? | Продуктовласник |
| OQ-5 | На якому етапі вмикаємо ED-safety guardrails і повну privacy-програму (тригер — відкриття для не-знайомих)? | Продуктовласник |
| OQ-6 | ORM: Prisma чи Drizzle (Prisma — зріліший DX; Drizzle — легший, ближчий до SQL)? | tech |
