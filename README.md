# Green Hosting Inspector

The **Green Hosting Inspector** is a Visual Studio Code extension that helps developers identify whether the URLs in their code are hosted on environmentally friendly (green) hosting providers. It uses the [Green Web Foundation API](https://www.thegreenwebfoundation.org/) to check the hosting status of URLs and provides visual feedback directly in the editor.

---

## Features

- **Automatic URL Detection**: Detects URLs in your code files that are encapsulated in quotes (`"`, `'`, or `` ` ``).
- **Green Hosting Check**: Verifies if the URLs are hosted on green hosting providers using the Green Web Foundation API.
- **Visual Feedback**:
  - URLs hosted on green providers are highlighted with a green background.
  - URLs not hosted on green providers are highlighted with a red background.
- **Hover Information**: Hover over a URL to see details about the hosting provider.
- **Caching**: Results are cached for 24 hours to avoid redundant API calls and improve performance.
- **Real-Time Updates**: Automatically updates decorations as you edit your code.

---

## Requirements

- An active internet connection is required to query the Green Web Foundation API.
- Supported file types:
  - JavaScript (`.js`)
  - TypeScript (`.ts`)
  - Python (`.py`)
  - Java (`.java`)
  - C# (`.cs`)
  - HTML (`.html`)
  - CSS (`.css`)

---

## Installation

1. Clone the repository or download the source code.
2. Open the project in Visual Studio Code.
3. Run the extension locally:
   - Press `F5` to start the extension in a new Extension Development Host window.
4. Alternatively, package the extension:
   - Run `vsce package` to create a `.vsix` file.
   - Install the `.vsix` file in VS Code by selecting **Extensions > ... > Install from VSIX**.

---

## How It Works

1. Open a supported code file in VS Code.
2. Add URLs to your code, encapsulated in quotes (`"`, `'`, or `` ` ``).
3. The extension will:
   - Detect the URLs.
   - Query the Green Web Foundation API to check their hosting status.
   - Highlight the URLs with green or red backgrounds based on the result.
4. Hover over a URL to see the hosting provider details.

---

## Extension Settings

This extension does not currently add any configurable settings. Future versions may include options for:

- Enabling/disabling the extension.
- Customizing the cache expiry time.
- Adding support for additional file types.

---

## Known Issues

- URLs not encapsulated in quotes (`"`, `'`, or `` ` ``) are not detected.
- Large files with many URLs may take longer to process.
- The extension only supports specific file types (see the **Requirements** section).

---

## Release Notes

### 1.0.0

- Initial release of the Green Hosting Inspector.
- Features:
  - Automatic URL detection.
  - Green hosting checks using the Green Web Foundation API.
  - Visual feedback with hover information.
  - Caching for improved performance.

---

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [The Green Web Foundation](https://www.thegreenwebfoundation.org/) for providing the API to check green hosting status.
- The Visual Studio Code team for their excellent extension development tools.

---

## For More Information

- [Visual Studio Code Extension API](https://code.visualstudio.com/api)
- [The Green Web Foundation API Documentation](https://www.thegreenwebfoundation.org/)

**Enjoy using the Green Hosting Inspector!**
