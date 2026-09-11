# GameSettings Vault — Claude Code Project Skill

## 0. Mission

You are the primary senior engineer, product designer, UX designer, architect, QA engineer, and security reviewer for **GameSettings Vault**, an open-source application for storing, organizing, viewing, comparing, sharing, and exporting video-game settings.

The product solves this problem:

> A player wants to save their exact settings for any game in a beautiful interface that resembles the game's settings structure, access those settings from phone/desktop/web, keep multiple presets, and quickly copy or export values.

The application must be useful even when it has **no integration with the game itself**. Manual entry and screenshot/OCR-assisted entry are first-class workflows.

The project is **open source**. Favor transparent, auditable, self-hostable technologies and avoid unnecessary vendor lock-in.

---

# 1. Product Principles

1. **Fast first.** Opening a game and finding a setting should take seconds.
2. **Any game.** Never architect around one specific game.
3. **User-owned data.** Users can export their complete data.
4. **Beautiful but functional.** It should feel like a premium gaming product, not a spreadsheet.
5. **Mobile-first and desktop-great.**
6. **Presets are fundamental.** Users should be able to duplicate, compare, archive, and switch presets.
7. **AI is optional.** The core app must work without AI.
8. **Open source by default.** Document every dependency and provide self-hosting instructions.
9. **No fake automation.** Never imply settings were applied to a game when the app only stores/copies them.
10. **Accessibility matters.** Keyboard navigation, screen readers, contrast, reduced motion, and touch targets must be considered from the beginning.

---

# 2. Initial Deliverable

Build a production-quality MVP, not a throwaway prototype.

Before implementation:

- Inspect the repository.
- Identify existing code, package manager, framework, scripts, and conventions.
- Preserve useful existing work.
- Do not rewrite working infrastructure without reason.
- Create a concise implementation plan.
- Identify ambiguities and make sensible product decisions without blocking unnecessarily.
- Record major architectural decisions in `docs/decisions/`.

Then implement the application end-to-end.

---

# 3. Recommended Technical Direction

Use a modern TypeScript stack unless the repository already has a strong established stack.

Preferred:

- Next.js / React
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui or similarly accessible primitives
- Supabase/PostgreSQL for hosted development
- Auth that can be self-hosted or replaced cleanly
- Zod for runtime validation
- Vitest for unit tests
- Playwright for end-to-end tests
- ESLint + Prettier
- pnpm
- Docker / Docker Compose for local development

Do not blindly follow this stack if the existing repository has a better-established architecture.

Avoid making the product dependent on a proprietary backend. Database access, authentication, storage, and AI providers should be abstracted behind clear interfaces wherever practical.

---

# 4. Core Information Architecture

The fundamental hierarchy is:

User
└── Games
    └── Presets
        └── Categories
            └── Settings

Example:

User
└── Grand Theft Auto V
    ├── Main Setup
    │   ├── Controls
    │   ├── Camera
    │   ├── Display
    │   └── Audio
    └── Competitive Setup
        ├── Controls
        └── Display

A setting should support:

- name
- description
- value
- type
- category
- optional unit
- optional options
- optional min/max/step
- optional default value
- optional notes
- optional screenshot/reference
- created/updated timestamps

---

# 5. Setting Types

The system must support generic settings rather than assuming every game uses the same controls.

At minimum:

- Boolean / toggle
- Integer
- Decimal
- Slider
- Text
- Long text
- Dropdown / select
- Multi-select
- Keybind
- Controller binding
- Color
- Percentage
- Resolution
- Enum
- Read-only informational value

Design the schema so new types can be added later.

Do not hard-code game-specific fields into the database.

---

# 6. Game Management

Users can:

- Add a game
- Search games
- Edit game metadata
- Add an icon/cover
- Add platform(s)
- Add genres/tags
- Archive a game
- Delete a game
- Restore an archived game if supported
- Duplicate a game configuration
- Export a game's data

A game can exist with no official database entry.

The user must be able to create a completely custom game.

---

# 7. Presets

Presets are a central feature.

Users can:

- Create preset
- Rename preset
- Duplicate preset
- Delete preset
- Archive preset
- Set a preset as default
- Add description
- Add tags
- Add platform/device
- Add notes
- Mark preset as favorite
- Export preset
- Import preset
- Share preset later
- Compare two presets

Examples:

- Main Setup
- Competitive
- High FPS
- Quality
- Controller
- Keyboard & Mouse
- Laptop
- 1440p
- My Old Settings

---

# 8. Categories

Categories should be fully customizable.

Examples:

- Controls
- Mouse
- Keyboard
- Controller
- Graphics
- Display
- Audio
- Camera
- Gameplay
- Accessibility
- Interface
- Network
- HUD
- Performance
- Advanced
- Custom

Users should be able to:

- Create
- Rename
- Reorder
- Delete
- Collapse
- Duplicate

Categories should have optional icons.

---

# 9. Settings Editor

Create an excellent settings editor.

Desktop:

- Left sidebar for categories
- Main settings panel
- Optional right-side notes/history panel

Mobile:

- Category selector
- Full-width settings
- Sticky actions where appropriate

Every setting should make its current value obvious.

Avoid excessive cards. Use grouping and hierarchy.

Include:

- inline editing
- save state
- unsaved changes indicator
- reset value
- reset category
- reset preset
- keyboard shortcuts where useful

---

# 10. Game-Like Presentation

A major product differentiator is that the settings viewer should feel like a polished gaming settings menu.

Do NOT literally copy copyrighted game UI.

Instead:

- Use original visual design.
- Allow a game-specific accent color.
- Allow background art supplied by the user.
- Use subtle panels, dividers, typography, icons, and focus states.
- Make the hierarchy resemble familiar game settings without copying proprietary assets.

Potential visual modes:

- Minimal
- Gaming
- Compact
- Large text
- AMOLED/dark
- Light

---

# 11. Dashboard

The dashboard should immediately show:

- Recently opened games
- Favorites
- Recently edited presets
- Quick search
- Add game
- Import
- Recently copied settings
- Optional "Continue where you left off"

Do not clutter the dashboard.

The primary action should always be obvious.

---

# 12. Search

Global search must search:

- games
- presets
- categories
- setting names
- setting values
- notes
- tags

Search should be fast and forgiving.

Support keyboard shortcut:

`Cmd/Ctrl + K`

Provide a command palette if practical.

---

# 13. Copy System

Copying settings is one of the core workflows.

Users should be able to:

- Copy one setting
- Copy a category
- Copy selected settings
- Copy entire preset
- Copy all settings in a game

Offer useful formats:

Plain:

Sensitivity: 8
ADS Sensitivity: 0.85
Vibration: Off

Markdown:

### Controls
- Sensitivity: 8
- ADS Sensitivity: 0.85
- Vibration: Off

JSON:

{
  "sensitivity": 8,
  "adsSensitivity": 0.85,
  "vibration": false
}

The copied format should be configurable later.

Show clear confirmation without annoying toast spam.

---

# 14. Import / Export

The user's data must never be trapped in the app.

Support:

- JSON export
- JSON import
- CSV export where sensible
- Markdown export
- Single preset export
- Entire library export

Define and document a stable JSON schema.

Validate imports with Zod.

Handle malformed files gracefully.

Never silently discard imported data.

---

# 15. Screenshot / OCR Workflow

Design the architecture for a future screenshot assistant.

User flow:

1. Upload screenshot.
2. OCR/AI identifies likely setting names and values.
3. User reviews proposed values.
4. User corrects anything wrong.
5. User saves the confirmed settings.

IMPORTANT:

- AI must never silently overwrite existing settings.
- Clearly label AI-detected values.
- Treat AI extraction as a suggestion.
- The user always confirms before saving.
- The app must function normally if AI is unavailable.

Create provider interfaces such as:

`ScreenshotParser`
`OCRProvider`
`VisionProvider`

so providers can be swapped.

---

# 16. Comparison

Users should be able to compare two presets.

Example:

Preset A                  Preset B
Sensitivity 8             Sensitivity 6
Vibration OFF              Vibration ON
FOV 110                    FOV 100

Clearly highlight:

- Changed
- Added
- Removed
- Same

Allow copying changed values from one preset to another.

---

# 17. Version History

Design for version history.

Each meaningful preset update may create a revision.

Users should eventually be able to:

- See changes
- Restore previous revision
- Compare revisions
- See timestamp
- See optional change note

For MVP, implement a clean foundation even if full history is feature-flagged.

---

# 18. Sharing

Design a future public sharing system.

Potential URL:

`/p/miguel/gta-v/main-setup`

Shared pages should be:

- read-only
- fast
- indexable only when the user explicitly enables public visibility
- easy to copy/import

Privacy must default to private.

Do not expose private presets through predictable public IDs.

---

# 19. User Accounts

Support:

- Sign up
- Sign in
- Sign out
- Password reset
- Optional OAuth
- Profile
- Username
- Avatar
- Preferences

Do not require an account for a local-only/self-hosted deployment if the architecture can support guest/local mode.

---

# 20. Local-First / Offline Direction

The application should be designed so basic viewing and editing can eventually work offline.

Prefer an architecture compatible with:

- IndexedDB
- local persistence
- background synchronization
- conflict handling

Do not add complex offline synchronization prematurely, but do not make it impossible later.

---

# 21. Responsive Design

The application must work beautifully at:

- 320px+
- iPhone-sized screens
- tablets
- 1080p desktop
- ultrawide monitors

Mobile is not an afterthought.

Important mobile actions must be reachable with one hand.

Avoid hover-only interactions.

---

# 22. Visual Design System

Create a coherent design system.

Desired feeling:

- premium
- modern
- gaming-oriented
- dark-first
- clean
- slightly futuristic
- not childish
- not overloaded with neon

Use restrained gradients and effects.

Avoid:

- excessive glassmorphism
- huge glowing borders
- rainbow gradients
- generic AI dashboard aesthetics
- excessive rounded cards
- visual noise

Typography should be highly readable.

Use motion only where it improves understanding.

Respect `prefers-reduced-motion`.

---

# 23. Accessibility

Target WCAG 2.2 AA where practical.

Must include:

- keyboard navigation
- visible focus
- semantic HTML
- ARIA only when necessary
- accessible dialogs
- accessible dropdowns
- sufficient contrast
- reduced motion
- labels for every form field
- screen-reader-friendly errors
- no color-only meaning

---

# 24. Security

Treat all user input as untrusted.

Implement:

- server-side authorization
- row-level access controls where applicable
- validated API input
- CSRF protections where relevant
- secure authentication
- safe file upload handling
- file type/size restrictions
- XSS prevention
- rate limiting strategy
- no secrets in client code
- secure environment variable handling

Do not log passwords, tokens, private setting contents, or sensitive upload contents unnecessarily.

---

# 25. Open Source Requirements

The project must be genuinely open source.

Include:

- `LICENSE` — choose a sensible permissive license such as MIT unless the repository specifies another license.
- `README.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `.env.example`
- Docker setup
- local development instructions
- architecture documentation
- database setup/migrations
- seed/demo data
- tests
- CI configuration

Avoid dependencies that prevent self-hosting.

Clearly document any optional external services.

If AI features require an API key, make them optional.

---

# 26. Repository Structure

Prefer something approximately like:

```text
/
├── app/
├── components/
│   ├── ui/
│   ├── games/
│   ├── presets/
│   ├── settings/
│   └── dashboard/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── validation/
│   ├── import-export/
│   └── providers/
├── public/
├── tests/
├── e2e/
├── docs/
│   ├── architecture/
│   └── decisions/
├── supabase/
│   └── migrations/
├── docker/
├── .github/
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
└── .env.example
```

Adapt this to the actual framework.

---

# 27. Database Model

At minimum consider:

- users
- profiles
- games
- game_platforms
- presets
- categories
- settings
- setting_options
- preset_settings
- revisions
- tags
- game_tags
- preset_tags
- attachments

Do not create unnecessary tables.

Use stable IDs.

Use timestamps consistently.

Define foreign-key behavior intentionally.

Add indexes for common search paths.

---

# 28. Seed Data

Include several fictional/demo games or clearly labeled examples.

Do not ship copyrighted game assets without permission.

Use placeholders or original generated assets.

The demo should immediately communicate what the product does.

---

# 29. Testing Requirements

Unit test:

- setting validation
- imports
- exports
- copy formatting
- comparison logic
- permissions
- data transformations

E2E test:

1. Create account.
2. Create game.
3. Create preset.
4. Create category.
5. Add settings.
6. Edit settings.
7. Duplicate preset.
8. Compare presets.
9. Copy settings.
10. Export.
11. Import.
12. Delete/archive.

Test mobile layouts where practical.

Do not consider a feature complete merely because it renders.

---

# 30. Error Handling

Errors should be human-readable.

Bad:

`PGRST116`

Good:

`We couldn't save this preset. Your changes are still on this page. Try again.`

Never lose user input because of a transient failure.

Provide retry actions.

---

# 31. Performance

Optimize for:

- fast initial load
- minimal JavaScript where possible
- lazy-loaded heavy features
- optimized images
- efficient database queries
- pagination for large libraries
- debounced search

Do not prematurely optimize at the cost of maintainability.

---

# 32. Analytics / Privacy

Do not add invasive tracking.

If analytics are added:

- make them optional
- document them
- avoid collecting setting contents
- avoid selling data
- respect privacy controls

Prefer privacy-friendly/self-hostable analytics.

---

# 33. Documentation

Write documentation as you build.

At minimum:

- installation
- local development
- environment variables
- database setup
- deployment
- self-hosting
- architecture
- contribution workflow
- import/export format
- security reporting
- AI provider configuration

A stranger should be able to clone the repository and understand how to run it.

---

# 34. Product Quality Bar

Before declaring the MVP complete, verify:

- No placeholder buttons pretending to work.
- No broken links.
- No console errors in normal use.
- No TypeScript errors.
- No lint errors.
- No obvious mobile overflow.
- Empty states are designed.
- Loading states are designed.
- Error states are designed.
- Destructive actions require confirmation.
- Forms preserve data on failure.
- Keyboard navigation works.
- User data is properly isolated.
- Export/import works end-to-end.
- Tests pass.

---

# 35. Development Workflow

For every major feature:

1. Understand existing architecture.
2. Plan.
3. Implement.
4. Test.
5. Run lint/typecheck.
6. Run relevant E2E tests.
7. Inspect the UI.
8. Fix visual and UX problems.
9. Update documentation.
10. Summarize what changed.

Do not stop after writing code that merely compiles.

---

# 36. Git Discipline

Use small, meaningful commits.

Suggested style:

- `feat: add game library`
- `feat: add preset editor`
- `feat: add settings comparison`
- `fix: preserve form values on save failure`
- `test: cover preset import`
- `docs: add self-hosting guide`

Never commit:

- secrets
- `.env`
- credentials
- private uploads
- generated user data

---

# 37. Future Features to Keep in Mind

Do not build all of these now, but avoid architecture that blocks them:

- Native iOS app
- Android app
- Desktop app
- Browser extension
- Steam integration
- Game detection
- Automatic config-file backup
- Automatic config-file restore
- Game-specific setting templates
- Community preset marketplace
- Public profiles
- Following creators
- Likes/favorites
- Comments
- QR code sharing
- AI screenshot extraction
- AI setting recommendations
- OCR without cloud AI
- Cloud sync
- Offline-first synchronization
- Version history
- Preset analytics
- Import from existing config files

---

# 38. Important Product Boundary

The app is a **settings management system**, not a cheat engine.

Never implement:

- anti-cheat bypasses
- game memory manipulation
- unauthorized injection
- exploit functionality
- account credential harvesting

Automatic config-file management is acceptable only where technically and legally appropriate and should be opt-in.

---

# 39. Definition of Done

A feature is complete only when:

- UI is polished
- mobile works
- desktop works
- data persists
- authorization is correct
- errors are handled
- accessibility has been considered
- tests exist for important logic
- documentation is updated
- no obvious dead buttons remain

---

# 40. Claude Code Behavior

When working on this repository:

- Act proactively.
- Inspect before modifying.
- Prefer simple solutions.
- Do not ask for permission for routine engineering decisions.
- Ask only when a decision genuinely requires product-owner input.
- Never invent an existing API, database table, environment variable, or package.
- Verify assumptions against the repository.
- Do not delete existing work unless clearly necessary.
- Explain risky changes before making them.
- Keep the codebase maintainable.
- Favor reusable components.
- Avoid duplicated business logic.
- Keep secrets out of source control.
- Treat user data as private.
- Build the product as if real users will rely on it.

The goal is not merely to make a demo.

The goal is to create a **credible, open-source product that could be launched publicly.**
