const express = require("express");
const fileUpload = require("express-fileupload");
const { exec } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const { v4: uuidv4 } = require("uuid");

const app = express();

// Set FFmpeg path - check local ffmpeg directory first, then system PATH
const FFMPEG_PATH = fs.existsSync(path.join(__dirname, 'ffmpeg', 'ffmpeg.exe')) 
  ? path.join(__dirname, 'ffmpeg', 'ffmpeg.exe')
  : 'ffmpeg';

console.log(`📹 Using FFmpeg at: ${FFMPEG_PATH}`);

app.use(fileUpload());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
const FRAME_DIR = path.join(__dirname, "public", "frames");
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(FRAME_DIR);

// Cleanup old sessions (older than 1 hour)
const cleanupOldSessions = () => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  [UPLOAD_DIR, FRAME_DIR].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > ONE_HOUR) {
        fs.removeSync(filePath);
        console.log(`Cleaned up: ${filePath}`);
      }
    });
  });
};

// Run cleanup every 30 minutes
setInterval(cleanupOldSessions, 30 * 60 * 1000);

// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/webm', 'video/x-flv', 'video/3gpp'
];

// --- Home page ---
app.get("/", (req, res) => {
  res.render("index");
});

// --- Upload and extract frames ---
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.video) {
      return res.status(400).render("error", { 
        message: "No video file uploaded. Please select a video file." 
      });
    }

    const video = req.files.video;

    // Validate file size
    if (video.size > 100 * 1024 * 1024) {
      return res.status(400).render("error", { 
        message: "File too large. Maximum file size is 100MB." 
      });
    }

    // Validate file type
    if (!ALLOWED_VIDEO_TYPES.includes(video.mimetype)) {
      return res.status(400).render("error", { 
        message: "Invalid file type. Please upload a valid video file." 
      });
    }

    const sessionId = uuidv4();
    const uploadPath = path.join(UPLOAD_DIR, `${sessionId}_${video.name}`);
    const outputDir = path.join(FRAME_DIR, sessionId);
    fs.ensureDirSync(outputDir);

    await video.mv(uploadPath);

    // Get frame rate from form (default: extract all frames)
    const frameRate = req.body.frameRate || 'all';
    let ffmpegCmd;

    if (frameRate === 'all') {
      ffmpegCmd = `"${FFMPEG_PATH}" -i "${uploadPath}" "${outputDir}/frame_%04d.png"`;
    } else {
      // Extract frames at specified rate (e.g., 1fps, 5fps, 10fps)
      ffmpegCmd = `"${FFMPEG_PATH}" -i "${uploadPath}" -vf "fps=${frameRate}" "${outputDir}/frame_%04d.png"`;
    }

    exec(ffmpegCmd, async (err, stdout, stderr) => {
      if (err) {
        console.error("FFmpeg error:", stderr);
        fs.removeSync(uploadPath);
        fs.removeSync(outputDir);
        return res.status(500).render("error", { 
          message: "Error extracting frames. The video file may be corrupted or in an unsupported format." 
        });
      }

      // Clean up uploaded video after extraction
      fs.removeSync(uploadPath);

      const frameFiles = fs.readdirSync(outputDir);
      if (frameFiles.length === 0) {
        fs.removeSync(outputDir);
        return res.status(500).render("error", { 
          message: "No frames could be extracted from the video." 
        });
      }

      const frames = frameFiles.map(f => `/frames/${sessionId}/${f}`);
      res.render("result", { frames, sessionId, frameCount: frames.length });
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).render("error", { 
      message: "An unexpected error occurred during upload. Please try again." 
    });
  }
});

// --- Download ZIP of all frames ---
app.get("/download-all/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const dir = path.join(FRAME_DIR, sessionId);
  
  if (!fs.existsSync(dir)) {
    return res.status(404).render("error", { 
      message: "Session not found. It may have expired." 
    });
  }

  // Set proper headers before starting the stream
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="frames_${sessionId}.zip"`);

  const archive = archiver("zip", { 
    zlib: { level: 9 } 
  });

  // Handle archive errors
  archive.on("error", (err) => {
    console.error("Archive error:", err);
    if (!res.headersSent) {
      res.status(500).render("error", { 
        message: "Error creating ZIP file." 
      });
    }
  });

  // Handle archive warnings
  archive.on("warning", (err) => {
    if (err.code === "ENOENT") {
      console.warn("Archive warning:", err);
    } else {
      throw err;
    }
  });

  // Pipe archive data to the response
  archive.pipe(res);

  // Add files from directory
  archive.directory(dir, false);

  // Finalize the archive (this is the critical part)
  archive.finalize();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
