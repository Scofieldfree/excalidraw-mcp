# Changelog

All notable changes to this project will be documented in this file.

See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.1](https://github.com/scofieldfree/excalidraw-mcp/compare/v0.1.0...v0.1.1) (2026-02-08)

### ♻️ Refactoring

- **skills:** simplify excalidraw-drawing-accuracy to lightweight workflow ([af595f3](https://github.com/scofieldfree/excalidraw-mcp/commit/af595f3e56b4e31b9614d8c7476f46d474628a11))

### 📝 Documentation

- enhance README with comprehensive usage examples and architecture ([43c9074](https://github.com/scofieldfree/excalidraw-mcp/commit/43c9074babb655c34de2c2ef94674ebee0c2dd7f))
- **skills:** enhance excalidraw-drawing-accuracy workflow and quality gates ([e11cf5e](https://github.com/scofieldfree/excalidraw-mcp/commit/e11cf5e6606bada4744cc8baa4f1d8ce8dae1538))

### ✨ Features

- enhance shape label support with normalized alignment ([d64aad9](https://github.com/scofieldfree/excalidraw-mcp/commit/d64aad9f04146c260dc34bee14299f07676fe80e))
- **skills:** add excalidraw-drawing-accuracy skill ([5d24874](https://github.com/scofieldfree/excalidraw-mcp/commit/5d24874d2771f41816c47ef4c5a5e33d0e80cdb7))

## 0.1.0 (2026-02-08)

### 📝 Documentation

- add project infrastructure files ([6386aa9](https://github.com/scofieldfree/excalidraw-mcp/commit/6386aa9a09d4e6225d4d9f7234350e8e0cda851e))
- **i18n:** translate all tool descriptions and README to English ([d7ec2fa](https://github.com/scofieldfree/excalidraw-mcp/commit/d7ec2faf12a103605486dbc5bddd208748b2453f))

### ♻️ Refactoring

- **app:** use type-only imports and update Excalidraw API ([0647e69](https://github.com/scofieldfree/excalidraw-mcp/commit/0647e699aac9abe16525a0027dfd5b05efb270a6))
- **elements:** implement skeleton-based element creation with frontend delegation ([1fae9d2](https://github.com/scofieldfree/excalidraw-mcp/commit/1fae9d233283b1f6c656e3e6d1c5da69230052ca))
- **tools:** extract element normalization to shared module ([3840aef](https://github.com/scofieldfree/excalidraw-mcp/commit/3840aef468465da3b07fdc7a7c84f147d39470c4))

### 🐛 Bug Fixes

- **web:** handle collaborators property to prevent serialization errors ([5833bdc](https://github.com/scofieldfree/excalidraw-mcp/commit/5833bdcfcc2383147a25a374959c8bdb12539137))
- **websocket:** normalize linear elements during WebSocket sync ([e0a2f4f](https://github.com/scofieldfree/excalidraw-mcp/commit/e0a2f4f3263af97f419e455bfe7961e9af46a68b))

### ✨ Features

- **core:** implement session state and WebSocket synchronization ([58df55f](https://github.com/scofieldfree/excalidraw-mcp/commit/58df55fa5b8507baeca3abac73bcb4834d767af1))
- **elements:** add container binding and smart text sizing ([f5b3923](https://github.com/scofieldfree/excalidraw-mcp/commit/f5b39230b31d7d88e0399fa653309f517cfb0885))
- **elements:** add element ID and binding support ([6580df6](https://github.com/scofieldfree/excalidraw-mcp/commit/6580df6fbc629635e158c7e426d1ea61407307ec))
- **elements:** enhance element schema with full Excalidraw support ([3150a06](https://github.com/scofieldfree/excalidraw-mcp/commit/3150a064bcefb94c4925b41b4baa563c6d876db5))
- **export:** implement server-side file export with browser rendering ([0506ec7](https://github.com/scofieldfree/excalidraw-mcp/commit/0506ec7de55def08817055a986f023b0a27bce48))
- initial project setup with MCP server structure ([d42dce2](https://github.com/scofieldfree/excalidraw-mcp/commit/d42dce26fecd32685922c939f1ea14c9c941d27b))
- **server:** enhance multi-session support with port auto-increment ([f17ef5d](https://github.com/scofieldfree/excalidraw-mcp/commit/f17ef5d3f5596562c3dbe8aab32258ec8c4d9f44))
- **tools:** add architecture diagram template tool ([05fe6c5](https://github.com/scofieldfree/excalidraw-mcp/commit/05fe6c52d8de6bf0135a33a3636fb40f19815354))
- **tools:** add Mermaid diagram conversion support ([cba94ac](https://github.com/scofieldfree/excalidraw-mcp/commit/cba94ac1cc3df04c40d5dfdd6489d9b14eb55b21))
- **tools:** add remaining MCP tools for diagram manipulation ([a43ba04](https://github.com/scofieldfree/excalidraw-mcp/commit/a43ba0486ecb6a0ab1687e810a41ec682e788ec0))
- **tools:** auto-expand containers for long labels in Mermaid diagrams ([a7376d0](https://github.com/scofieldfree/excalidraw-mcp/commit/a7376d00c636c0aeb59ee1e494f60378c961e7ff))
- **tools:** implement start_session and add_elements MCP tools ([6b408f0](https://github.com/scofieldfree/excalidraw-mcp/commit/6b408f06945588671da10897a377d4be748dbf87))
- **tools:** improve element ID display and session management ([d3f4be0](https://github.com/scofieldfree/excalidraw-mcp/commit/d3f4be0334e6bba25e7032b0f5533a486c3dc3ed))
- **ui:** auto-center scene content when loading new elements ([cc6f6b4](https://github.com/scofieldfree/excalidraw-mcp/commit/cc6f6b4cdf81bc4b8a5f9c5d41426214e346b14b))
- **web:** implement Excalidraw editor integration ([f232935](https://github.com/scofieldfree/excalidraw-mcp/commit/f232935aae6428f720aa40e399625388861e84b1))
- **web:** implement HTTP server and WebSocket real-time sync ([8a2384c](https://github.com/scofieldfree/excalidraw-mcp/commit/8a2384cceff5091c8208ba2b88a3832718a408a1))
- **websocket:** add batch queuing and replay for skeleton elements ([0829617](https://github.com/scofieldfree/excalidraw-mcp/commit/0829617b8ccf4671733368c34fcdd2c719261b55))

## 0.1.0 (2026-02-08)

### ✨ Features

- Initial release of Excalidraw MCP Server
- Real-time browser preview with WebSocket synchronization
- Support for multiple diagram sessions
- Mermaid syntax conversion support
- PNG/SVG/JSON export capabilities
- Element manipulation (add, update, delete)
- Arrow binding with automatic connection to shapes
- Architecture diagram template

### 📝 Documentation

- Comprehensive implementation guide
- Development guide
- Drawing standards documentation
- Architecture analysis
