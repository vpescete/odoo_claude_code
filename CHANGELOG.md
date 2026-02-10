# Changelog

All notable changes to Clodoo will be documented in this file.

## [0.3.0] - 2026-02-10

### Added
- OAuth browser login for Claude accounts (Pro/Max) via "Login with Browser" button
- Token input kept as secondary option for Anthropic Console tokens

## [0.2.1] - 2026-02-10

### Fixed
- Windows: dependency checker now finds Git and PostgreSQL in standard install paths when not in PATH
- Windows: winget "already installed" exit code no longer treated as error

## [0.2.0] - 2026-02-10

### Fixed
- pip dependency installer on Windows ("Unknown dependency: pip" error)

### Improved
- CI/CD: use `actions/setup-python` for node-gyp compatibility on all runners
- CI/CD: use `npm install` instead of `npm ci` for cross-platform lockfile support

## [0.1.0] - 2026-02-10

### Added

#### Core
- Desktop application for managing multiple Odoo instances (Electron + React)
- Custom frameless window with native traffic lights (macOS) and custom title bar controls
- Sidebar navigation with instance list, dashboard, and settings
- Keyboard shortcuts: `Cmd/Ctrl+N` new instance, `Cmd/Ctrl+,` settings, `Esc` back

#### Instance Management
- Create Odoo instances (versions 16.0–18.0) with automated setup
- Clone Odoo source from GitHub with branch selection
- Python virtualenv creation and pip dependency installation
- PostgreSQL database creation and configuration
- Auto-generated `odoo.conf` with port conflict detection
- Start, stop, restart instances with real-time status tracking
- Live log streaming with color-coded log levels
- Configuration editor with bidirectional sync
- Instance deletion with optional database cleanup

#### Addons Management
- Clone third-party addon repositories via Git URL
- Branch switching and pull with progress tracking
- Automatic `addons_path` configuration in `odoo.conf`

#### Claude Code Integration
- Embedded Claude Code AI assistant per instance
- Streaming conversation with full message rendering (text, code blocks, tool use)
- Model selection and permission mode switching
- Session history with resume capability
- Slash commands support
- File attachment via drag & drop or file dialog
- Authentication via API key or OAuth token

#### Odoo Shell
- Integrated PTY terminal for Odoo shell (`odoo-bin shell`)
- Full xterm.js terminal with resize support

#### Settings
- Configurable default Odoo version, Python path, PostgreSQL credentials
- Anthropic API key and GitHub token management (secure storage)
- First-launch setup wizard with dependency checker
- Automated installation of missing dependencies (Python, PostgreSQL, Node.js, Git)

#### Build & Distribution
- Electron Builder configuration for macOS (.dmg), Windows (.exe), Linux (.AppImage, .deb)
- macOS entitlements for network, JIT, and file access
- Auto-update via `electron-updater` with GitHub Releases
- Update banner UI (available → downloading → ready to install)
- GitHub Actions CI: typecheck on pull requests
- GitHub Actions Release: build and publish on version tags (`v*`)
