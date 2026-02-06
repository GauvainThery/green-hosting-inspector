# 🌱 Green Hosting Inspector

Powered by [thegreenwebfoundation.org](https://www.thegreenwebfoundation.org) 🌍✨  
This project leverages their invaluable resources to help make the web greener, one website at a time! 💚

## 🚀 What is Green Hosting Inspector?

The Green Hosting Inspector is a Visual Studio Code extension that checks if URLs in your code are hosted on environmentally friendly hosting providers. It uses the Green Web Foundation's API to perform these checks.

## 🛠️ Features

- 🌐 **Smart URL Detection**: Automatically detects URLs in your code, including:
  - Full URLs: `https://example.com/path`
  - Bare domains: `example.com`
  - URLs in comments and strings
- 🔵 **Subtle Visual Indicators**: A small colored dot appears before each URL:
  - 🟢 **Green dot**: Verified green hosting (runs on renewable energy)
  - 🟡 **Yellow dot**: No evidence of green hosting in the Green Web Foundation database
- 💬 **Informative Hover**: Hover over any URL to see:
  - Green hosting status
  - Hosting provider name (if known)
  - Links to learn more or find green hosting providers
- 📊 **Repository Metrics Dashboard**: Get an overview of your entire repository:
  - Total URLs and unique domains count
  - Green-hosted vs not-verified statistics
  - Visual percentage bar showing green hosting ratio
  - Detailed table with each domain's status, hosting provider, and file locations
  - One-click refresh to rescan your workspace
- ⚡ **High Performance**:
  - Results cached for 1 week (persists across VS Code restarts)
  - Batch API calls for multiple URLs
  - Smart change detection to avoid redundant scans
  - Lightweight scanning (skips large files and build artifacts)

## 📦 Installation

1. Open Visual Studio Code.
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window or pressing `Ctrl+Shift+X` (`Cmd+Shift+X` on Mac).
3. Search for "Green Hosting Inspector" in the Extensions Marketplace.
4. Click "Install" to add the extension to your VS Code.

Alternatively, you can install it from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/).

## 🧑‍💻 How to Use

### Inline URL Checking

1. Open a file in VS Code that contains URLs (e.g., `.js`, `.ts`, `.html`, `.py`, etc.).
2. The extension will automatically detect URLs and check if they are hosted on green hosting providers.
3. Look for the colored dot before each URL:
   - 🟢 Green = Verified green hosting
   - 🟡 Yellow = No evidence of green hosting
4. Hover over a URL to see detailed information and helpful links.

### Repository Metrics Dashboard

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
2. Type "Green Hosting Inspector: Repository Metrics" and press Enter.
3. The dashboard will scan your entire workspace and display:
   - Summary statistics (total URLs, unique domains, green vs not-verified counts)
   - A visual percentage bar showing your green hosting ratio
   - A detailed table of all domains with their green hosting status
4. Click the "Refresh" button to rescan your workspace at any time.

### Commands

- **Green Hosting Inspector: Repository Metrics** - Open the workspace metrics dashboard
- **Green Hosting Inspector: Clear Cache** - Clear the cached green hosting results

## 🤝 Contributing

At the moment, contributions are not possible. Stay tuned for updates in the future when we open the project for contributions!

## 📜 License

This project is licensed under the MIT License. See [LICENSE.md](LICENSE.md) for details.

## 🌟 Acknowledgments

A big thank you to [thegreenwebfoundation.org](https://www.thegreenwebfoundation.org) for their invaluable resources and inspiration. Together, we can build a greener web! 💚

---

Happy green development! 🚀
