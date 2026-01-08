require('dotenv').config();
const express = require("express");
const fileUpload = require("express-fileupload");
const { exec } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Gemini AI Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY not found in environment variables');
  console.error('📝 Please create a .env file with your API key (see .env.example)');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Set FFmpeg path
const FFMPEG_PATH = fs.existsSync(path.join(__dirname, 'ffmpeg', 'ffmpeg.exe')) 
  ? path.join(__dirname, 'ffmpeg', 'ffmpeg.exe')
  : 'ffmpeg';

const FFPROBE_PATH = fs.existsSync(path.join(__dirname, 'ffmpeg', 'ffprobe.exe')) 
  ? path.join(__dirname, 'ffmpeg', 'ffprobe.exe')
  : 'ffprobe';

console.log(`📹 Using FFmpeg at: ${FFMPEG_PATH}`);
console.log(`🤖 AI-Powered Frame Analysis: Enabled`);

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'tmp'),
  limits: { fileSize: 100 * 1024 * 1024 },
  abortOnLimit: true
}));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve favicon
app.get('/favicon.ico', (req, res) => {
  res.redirect(301, '/favicon.svg');
});

const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
const FRAME_DIR = path.join(__dirname, "public", "frames");
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(FRAME_DIR);
fs.ensureDirSync(path.join(__dirname, 'tmp'));

// Cleanup old sessions
const cleanupOldSessions = () => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  [UPLOAD_DIR, FRAME_DIR].forEach(dir => {
    try {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > ONE_HOUR) {
            fs.removeSync(filePath);
            console.log(`✨ Cleaned up: ${filePath}`);
          }
        }
      });
    } catch (err) {
      console.error(`Cleanup error: ${err.message}`);
    }
  });
};

setInterval(cleanupOldSessions, 30 * 60 * 1000);

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/webm', 'video/x-flv', 'video/3gpp'
];

// Utility: Get video metadata
async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    const cmd = `"${FFPROBE_PATH}" -v error -select_streams v:0 -count_packets -show_entries stream=width,height,r_frame_rate,duration,nb_frames -of json "${videoPath}"`;
    
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error('Failed to get video metadata'));
      }
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams[0];
        const [num, den] = stream.r_frame_rate.split('/').map(Number);
        const fps = num / den;
        
        resolve({
          width: stream.width,
          height: stream.height,
          fps: Math.round(fps),
          duration: parseFloat(stream.duration) || 0,
          totalFrames: parseInt(stream.nb_frames) || 0
        });
      } catch (e) {
        reject(new Error('Failed to parse video metadata'));
      }
    });
  });
}

// Utility: Calculate frame quality score using sharpness
async function calculateFrameQuality(framePath) {
  try {
    const image = sharp(framePath);
    const stats = await image.stats();
    
    // Calculate sharpness based on standard deviation
    const sharpness = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
    
    // Normalize to 0-100 scale
    const qualityScore = Math.min(100, Math.round(sharpness / 2));
    
    return qualityScore;
  } catch (err) {
    return 50; // Default medium quality if analysis fails
  }
}

// Utility: Detect scene changes using frame difference
async function detectSceneChange(frame1Path, frame2Path, threshold = 30) {
  try {
    const img1 = await sharp(frame1Path).resize(320, 240).raw().toBuffer();
    const img2 = await sharp(frame2Path).resize(320, 240).raw().toBuffer();
    
    let diff = 0;
    for (let i = 0; i < img1.length; i++) {
      diff += Math.abs(img1[i] - img2[i]);
    }
    
    const avgDiff = diff / img1.length;
    return avgDiff > threshold;
  } catch (err) {
    return false;
  }
}

// Utility: AI Frame Analysis using Gemini
async function analyzeFrameWithAI(framePath) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const imageData = fs.readFileSync(framePath);
    const base64Image = imageData.toString('base64');
    
    const prompt = `Analyze this video frame and provide:
1. Quality score (0-100)
2. Is this a keyframe? (yes/no)
3. Main subject/content (brief description)
4. Is the image blurry? (yes/no)

Response format (JSON):
{
  "quality": <number>,
  "isKeyframe": <boolean>,
  "description": "<string>",
  "isBlurry": <boolean>
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/png",
          data: base64Image
        }
      }
    ]);
    
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      quality: 70,
      isKeyframe: false,
      description: "Frame analysis",
      isBlurry: false
    };
  } catch (err) {
    console.error('AI analysis error:', err.message);
    return {
      quality: 70,
      isKeyframe: false,
      description: "Unable to analyze",
      isBlurry: false
    };
  }
}

// Home page
app.get("/", (req, res) => {
  res.render("index");
});

// Upload and extract frames
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.video) {
      return res.status(400).render("error", { 
        message: "No video file uploaded. Please select a video file." 
      });
    }

    const video = req.files.video;

    if (video.size > 100 * 1024 * 1024) {
      return res.status(400).render("error", { 
        message: "File too large. Maximum file size is 100MB." 
      });
    }

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

    // Get video metadata
    const metadata = await getVideoMetadata(uploadPath);

    // Get extraction settings
    const extractionMode = req.body.extractionMode || 'all';
    const frameRate = req.body.frameRate || 'all';
    const enableAI = req.body.enableAI === 'true';
    const removeBlurry = req.body.removeBlurry === 'true';
    const sceneDetection = req.body.sceneDetection === 'true';
    
    // Time range extraction
    const startTime = req.body.startTime || '0';
    const endTime = req.body.endTime || '';

    let ffmpegCmd;
    const filters = [];

    // Build FFmpeg command
    if (extractionMode === 'scene') {
      filters.push('select=gt(scene\\,0.3)');
    } else if (extractionMode === 'keyframe') {
      filters.push('select=eq(pict_type\\,I)');
    } else if (frameRate !== 'all') {
      filters.push(`fps=${frameRate}`);
    }

    const filterString = filters.length > 0 ? `-vf "${filters.join(',')}"` : '';
    const timeRange = endTime ? `-ss ${startTime} -to ${endTime}` : (startTime !== '0' ? `-ss ${startTime}` : '');

    ffmpegCmd = `"${FFMPEG_PATH}" ${timeRange} -i "${uploadPath}" ${filterString} "${outputDir}/frame_%05d.png"`;

    console.log(`🎬 Extracting frames: ${ffmpegCmd}`);

    exec(ffmpegCmd, async (err, stdout, stderr) => {
      if (err) {
        console.error("FFmpeg error:", stderr);
        fs.removeSync(uploadPath);
        fs.removeSync(outputDir);
        return res.status(500).render("error", { 
          message: "Error extracting frames. The video may be corrupted or in an unsupported format." 
        });
      }

      fs.removeSync(uploadPath);

      let frameFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
      
      if (frameFiles.length === 0) {
        fs.removeSync(outputDir);
        return res.status(500).render("error", { 
          message: "No frames could be extracted from the video." 
        });
      }

      // Frame analysis
      const frameAnalysis = [];

      // Basic quality scoring
      for (let i = 0; i < Math.min(frameFiles.length, 100); i++) {
        const framePath = path.join(outputDir, frameFiles[i]);
        const quality = await calculateFrameQuality(framePath);
        
        frameAnalysis.push({
          filename: frameFiles[i],
          quality: quality,
          isBlurry: quality < 30,
          isKeyframe: false
        });
      }

      // Scene detection
      let scenes = [];
      if (sceneDetection && frameFiles.length > 1) {
        let currentScene = 0;
        scenes.push({ scene: 0, start: 0, frames: [] });
        
        for (let i = 1; i < Math.min(frameFiles.length, 50); i++) {
          const frame1 = path.join(outputDir, frameFiles[i - 1]);
          const frame2 = path.join(outputDir, frameFiles[i]);
          
          const isSceneChange = await detectSceneChange(frame1, frame2);
          
          if (isSceneChange) {
            currentScene++;
            scenes.push({ scene: currentScene, start: i, frames: [] });
          }
          
          if (scenes[currentScene]) {
            scenes[currentScene].frames.push(frameFiles[i]);
          }
        }
      }

      // Remove blurry frames if requested
      if (removeBlurry) {
        const highQualityFrames = frameAnalysis.filter(f => !f.isBlurry).map(f => f.filename);
        
        frameFiles.forEach(f => {
          if (!highQualityFrames.includes(f)) {
            fs.removeSync(path.join(outputDir, f));
          }
        });
        
        frameFiles = highQualityFrames;
      }

      // AI analysis on best frames (limit to 5 for API cost)
      let aiAnalysis = [];
      if (enableAI && frameFiles.length > 0) {
        const sampleSize = Math.min(5, frameFiles.length);
        const step = Math.floor(frameFiles.length / sampleSize);
        
        for (let i = 0; i < sampleSize; i++) {
          const frameIndex = i * step;
          const framePath = path.join(outputDir, frameFiles[frameIndex]);
          
          try {
            const analysis = await analyzeFrameWithAI(framePath);
            aiAnalysis.push({
              filename: frameFiles[frameIndex],
              ...analysis
            });
          } catch (err) {
            console.error('AI analysis failed:', err.message);
          }
        }
      }

      const frames = frameFiles.map(f => `/frames/${sessionId}/${f}`);
      
      res.render("result", { 
        frames, 
        sessionId, 
        frameCount: frames.length,
        metadata,
        frameAnalysis: frameAnalysis.slice(0, 20),
        scenes: scenes.length > 0 ? scenes : null,
        aiAnalysis: aiAnalysis.length > 0 ? aiAnalysis : null,
        extractionMode,
        enabledFeatures: {
          ai: enableAI,
          sceneDetection,
          removeBlurry
        }
      });
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).render("error", { 
      message: "An unexpected error occurred. Please try again." 
    });
  }
});

// Download all frames as ZIP
app.get("/download-all/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const dir = path.join(FRAME_DIR, sessionId);
  
  if (!fs.existsSync(dir)) {
    return res.status(404).render("error", { 
      message: "Session not found. It may have expired." 
    });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="frames_${sessionId}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    if (!res.headersSent) {
      res.status(500).send("Error creating ZIP file");
    }
  });

  archive.pipe(res);
  archive.directory(dir, false);
  archive.finalize();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🎯 AI-Powered Video Frame Extractor Pro v3.0`);
});
