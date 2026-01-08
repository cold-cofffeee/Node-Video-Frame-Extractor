# 🎥 Video Frame Extractor

<div align="center">

A modern, user-friendly web application to extract frames from videos with ease. Built with Node.js, Express, and FFmpeg.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Technologies](#-technologies) • [Deployment](#-deployment) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### Core Functionality

- 🎥 **Video Upload** - Support for multiple video formats (MP4, MOV, AVI, MKV, WebM, FLV, 3GP)
- 🖼️ **Frame Extraction** - Powered by FFmpeg for high-quality frame extraction
- ⚡ **Customizable Frame Rate** - Extract all frames or choose specific rates (1fps, 2fps, 5fps, 10fps)
- 📦 **Bulk Download** - Download all extracted frames as a single ZIP file
- 💾 **Individual Downloads** - Download frames one by one if needed

### User Experience

- 🎨 **Modern UI** - Beautiful gradient design with smooth animations
- 📱 **Fully Responsive** - Works perfectly on desktop, tablet, and mobile devices
- 🔄 **Real-time Feedback** - Loading indicators and progress feedback
- 🖱️ **Drag & Drop** - Intuitive drag-and-drop file upload
- 📊 **Statistics Display** - See frame count and session details

### Technical Features

- 🧹 **Auto Cleanup** - Automatic deletion of old files after 1 hour
- 🔒 **File Validation** - MIME type checking and file size limits (max 100MB)
- ⚠️ **Error Handling** - Comprehensive error handling with user-friendly messages
- 🆔 **Unique Sessions** - UUID-based session management for concurrent users
- 🚀 **Performance** - Efficient streaming for large ZIP downloads
- 💻 **Cross-Platform** - Works on Windows, macOS, and Linux with automatic FFmpeg detection

---

## 🛠️ Technologies

### Backend

- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **FFmpeg** - Video processing engine (automatically detected)
- **Archiver** - ZIP file creation
- **Express-FileUpload** - File upload middleware

### Frontend

- **EJS** - Templating engine
- **Bootstrap 5** - UI framework
- **Bootstrap Icons** - Icon library
- **Vanilla JavaScript** - Client-side interactivity

### Utilities

- **fs-extra** - Enhanced file system operations
- **UUID** - Unique identifier generation

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0.0 or higher) - [Download here](https://nodejs.org/)
- **FFmpeg** - [Download here](https://ffmpeg.org/download.html) or use local copy
- **npm** or **yarn** - Comes with Node.js

### Installing FFmpeg

#### Option 1: Use Local FFmpeg (Windows) ⭐ Recommended for Local Development

1. Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Extract and place `ffmpeg.exe`, `ffplay.exe`, and `ffprobe.exe` in a `ffmpeg` folder in the project directory
3. The application will automatically detect and use the local FFmpeg
4. **Note:** The `ffmpeg` folder is in `.gitignore` and won't be pushed to GitHub

#### Option 2: System-Wide Installation

**Windows:**
1. Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Extract the ZIP file
3. Add the `bin` folder to your system PATH
4. Verify installation: `ffmpeg -version`

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

Verify FFmpeg installation:
```bash
ffmpeg -version
```

---

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/cold-cofffeee/Node-video-frame-extractor.git
cd Node-video-frame-extractor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up FFmpeg

Choose either Option 1 (local FFmpeg) or Option 2 (system-wide) from the [Prerequisites](#installing-ffmpeg) section above.

The application automatically detects:
- ✅ Local `ffmpeg.exe` in the `ffmpeg` folder (Windows)
- ✅ System-wide FFmpeg in PATH (all platforms)

### 4. Start the application

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
# Note: You'll need to install nodemon: npm install -g nodemon
```

### 5. Open your browser

Navigate to: `http://localhost:3000`

---

## 💻 Usage

### Basic Workflow

1. **Upload Video**
   - Click the upload area or drag & drop your video file
   - Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, 3GP
   - Maximum file size: 100MB

2. **Select Frame Rate**
   - Choose "Extract All Frames" for maximum quality
   - Or select a specific frame rate (1fps, 2fps, 5fps, 10fps)

3. **Process**
   - Click "Extract Frames" button
   - Wait for processing (time depends on video length and selected frame rate)

4. **Download**
   - View all extracted frames in the gallery
   - Download individual frames or all frames as a ZIP file

### Advanced Configuration

You can customize the application by modifying these settings in `app.js`:

```javascript
// Maximum file size (default: 100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Cleanup interval (default: 30 minutes)
setInterval(cleanupOldSessions, 30 * 60 * 1000);

// Session expiry time (default: 1 hour)
const ONE_HOUR = 60 * 60 * 1000;

// Server port (default: 3000)
const PORT = process.env.PORT || 3000;
```

---

## 📁 Project Structure

```
video-frame-extractor/
├── app.js                 # Main application file
├── package.json           # Project dependencies
├── README.md             # Documentation
├── render-build.sh       # Render.com build script
├── render.yaml           # Render.com configuration
├── ffmpeg/               # Local FFmpeg (optional, gitignored)
│   ├── ffmpeg.exe
│   ├── ffplay.exe
│   └── ffprobe.exe
├── views/                # EJS templates
│   ├── index.ejs        # Upload page
│   ├── result.ejs       # Results page
│   └── error.ejs        # Error page
└── public/              # Static files & output
    ├── uploads/         # Temporary video uploads
    └── frames/          # Extracted frames (UUID-based)
```

---

## 🌐 Deployment

### Deploy to Render.com

This project is configured for easy deployment on Render.com:

1. Fork or push this repository to GitHub
2. Create a new Web Service on [Render.com](https://render.com)
3. Connect your GitHub repository
4. Render will automatically use `render.yaml` configuration
5. The `render-build.sh` script will install FFmpeg automatically
6. Deploy!

**What happens on Render:**
- ✅ FFmpeg installed via `apt-get` (Linux)
- ✅ Application uses system FFmpeg from PATH
- ✅ No local `ffmpeg` folder needed (it's gitignored)

### Deploy to Other Platforms

#### Heroku

1. Create a Heroku app:
```bash
heroku create your-app-name
```

2. Add FFmpeg buildpack:
```bash
heroku buildpacks:add --index 1 https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
```

3. Deploy:
```bash
git push heroku main
```

#### Railway

1. Connect your GitHub repository
2. Add FFmpeg build command in Railway dashboard
3. Deploy automatically

---

## 🔒 Security Considerations

- ✅ File type validation (MIME type checking)
- ✅ File size limits (100MB max)
- ✅ Automatic cleanup of old files
- ✅ UUID-based session isolation
- ✅ Input sanitization and validation

### Recommended Enhancements for Production:
- Rate limiting (e.g., express-rate-limit)
- Authentication system
- Virus scanning for uploaded files
- HTTPS/SSL encryption
- CDN for static assets

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Ideas:
- Add support for more video formats
- Implement progress bar for processing
- Add video thumbnail preview
- Create batch processing feature
- Add frame quality selection
- Implement dark/light theme toggle

---

## 🐛 Known Issues

- Large videos (>100MB) are rejected. Consider implementing chunked uploads for larger files.
- Processing time increases significantly with higher frame rates
- Concurrent processing may impact server performance

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Hiranmay Roy**

Engineering student, programmer & philosopher. Passionate about combining logic, design, and simplicity.

- GitHub: [@cold-cofffeee](https://github.com/cold-cofffeee)
- Feel free to connect and contribute!

---

## 🙏 Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - The backbone of video processing
- [Bootstrap](https://getbootstrap.com/) - For the beautiful UI components
- [Express](https://expressjs.com/) - Fast, unopinionated web framework
- All contributors who help improve this project

---

## 📊 Repository Tags

`nodejs` `express` `ffmpeg` `video-processing` `frame-extraction` `bootstrap` `zip-download` `ejs` `javascript` `video-frames` `web-app` `video-editor` `video-tools`

---

<div align="center">
Made with ❤️ by Hiranmay Roy

If you found this project helpful, please consider giving it a ⭐!
</div>
