const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
const multer = require("multer");
const path = require("path");
const PDFDocument = require("pdfkit");
const fs = require("fs");

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

require('dotenv').config();


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// Schema for logs
const logSchema = new mongoose.Schema({
  candidateId: String,
  eventType: String,
  timestamp: { type: Date, default: Date.now },
});

const Log = mongoose.model("Log", logSchema);
const candidateSchema = new mongoose.Schema({
  candidateId: String,
  name: String,
  startTime: Date,
  endTime: Date,
});

const Candidate = mongoose.model("Candidate", candidateSchema);

// Delete candidate endpoint
app.delete("/candidate/:candidateId", async (req, res) => {
  try {
    const candidateId = req.params.candidateId;
    await Candidate.deleteMany({ candidateId });
    await Log.deleteMany({ candidateId });
    res.json({ success: true, message: `Deleted all data for candidate ${candidateId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get candidates
app.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find({});
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add log
app.post("/logs", async (req, res) => {
  try {
    const log = new Log(req.body);
    await log.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start interview
app.post("/start", async (req, res) => {
  const { candidateId, name } = req.body;
  const candidate = new Candidate({
    candidateId,
    name,
    startTime: new Date(),
  });
  await candidate.save();
  res.json({ success: true, candidate });
});

// End interview
app.post("/end", async (req, res) => {
  const { candidateId } = req.body;
  await Candidate.updateOne(
    { candidateId },
    { endTime: new Date() }
  );
  res.json({ success: true });
});

// Get report
app.get("/report/:candidateId", async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ candidateId: req.params.candidateId });
    const logs = await Log.find({ candidateId: req.params.candidateId });

    const uniqueLogs = [];
    const seenEvents = new Set();
    
    logs.forEach(log => {
      const eventKey = `${log.eventType}-${Math.floor(log.timestamp.getTime() / 5000)}`;
      if (!seenEvents.has(eventKey)) {
        seenEvents.add(eventKey);
        uniqueLogs.push(log);
      }
    });

    const focusLost = uniqueLogs.filter(l => l.eventType === "focus_lost").length;
    const absence = uniqueLogs.filter(l => l.eventType === "absence_detected").length;
    const multipleFaces = uniqueLogs.filter(l => l.eventType === "multiple_faces").length;
    const phoneDetected = uniqueLogs.filter(l => l.eventType === "cell phone_detected").length;
    const bookDetected = uniqueLogs.filter(l => l.eventType === "book_detected").length;
    const laptopDetected = uniqueLogs.filter(l => l.eventType === "laptop_detected").length;

    let duration = null;
    if (candidate?.startTime && candidate?.endTime) {
      duration = Math.round((candidate.endTime - candidate.startTime) / 1000);
    }

    let integrityScore = 100;
    integrityScore -= focusLost * 5;
    integrityScore -= absence * 10;
    integrityScore -= multipleFaces * 15;
    integrityScore -= phoneDetected * 10;
    integrityScore -= bookDetected * 8;
    integrityScore -= laptopDetected * 8;
    if (integrityScore < 0) integrityScore = 0;

    const report = {
      candidateId: req.params.candidateId,
      candidateName: candidate?.name || "Unknown",
      interviewDuration: duration ? `${duration} seconds` : "Ongoing",
      totalEvents: uniqueLogs.length,
      focusLost,
      absence,
      multipleFaces,
      phoneDetected,
      bookDetected,
      laptopDetected,
      integrityScore,
      logs: uniqueLogs,
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF report
app.get("/report/:candidateId/pdf", async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ candidateId: req.params.candidateId });
    const logs = await Log.find({ candidateId: req.params.candidateId });

    const uniqueLogs = [];
    const seenEvents = new Set();
    
    logs.forEach(log => {
      const eventKey = `${log.eventType}-${Math.floor(log.timestamp.getTime() / 5000)}`;
      if (!seenEvents.has(eventKey)) {
        seenEvents.add(eventKey);
        uniqueLogs.push(log);
      }
    });

    const focusLost = uniqueLogs.filter(l => l.eventType === "focus_lost").length;
    const absence = uniqueLogs.filter(l => l.eventType === "absence_detected").length;
    const multipleFaces = uniqueLogs.filter(l => l.eventType === "multiple_faces").length;
    const phoneDetected = uniqueLogs.filter(l => l.eventType === "cell phone_detected").length;
    const bookDetected = uniqueLogs.filter(l => l.eventType === "book_detected").length;
    const laptopDetected = uniqueLogs.filter(l => l.eventType === "laptop_detected").length;

    let duration = null;
    if (candidate?.startTime && candidate?.endTime) {
      duration = Math.round((candidate.endTime - candidate.startTime) / 1000);
    }

    let integrityScore = 100;
    integrityScore -= focusLost * 5;
    integrityScore -= absence * 10;
    integrityScore -= multipleFaces * 15;
    integrityScore -= phoneDetected * 10;
    integrityScore -= bookDetected * 8;
    integrityScore -= laptopDetected * 8;
    if (integrityScore < 0) integrityScore = 0;

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=report_${req.params.candidateId}.pdf`);
    doc.pipe(res);
    doc.fontSize(20).text("Proctoring Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text(`Candidate Name: ${candidate?.name || "Unknown"}`);
    doc.text(`Candidate ID: ${req.params.candidateId}`);
    doc.text(`Interview Duration: ${duration ? duration + " seconds" : "Ongoing"}`);
    doc.text(`Integrity Score: ${integrityScore}`);
    doc.moveDown();

    doc.fontSize(16).text("Event Summary:");
    doc.fontSize(12);
    doc.text(`• Focus Lost: ${focusLost}`);
    doc.text(`• Absence: ${absence}`);
    doc.text(`• Multiple Faces: ${multipleFaces}`);
    doc.text(`• Phone Detected: ${phoneDetected}`);
    doc.text(`• Book Detected: ${bookDetected}`);
    doc.text(`• Laptop Detected: ${laptopDetected}`);
    doc.moveDown();

    doc.fontSize(16).text("Detailed Logs:");
    doc.fontSize(10);
    
    const groupedLogs = {};
    uniqueLogs.forEach((log) => {
      const dateKey = log.timestamp.toLocaleDateString();
      if (!groupedLogs[dateKey]) {
        groupedLogs[dateKey] = [];
      }
      groupedLogs[dateKey].push(log);
    });

    Object.keys(groupedLogs).forEach(date => {
      doc.fontSize(12).text(`\n${date}:`, { underline: true });
      groupedLogs[date].forEach((log) => {
        const time = log.timestamp.toLocaleTimeString();
        doc.text(`  ${time} → ${log.eventType.replace(/_/g, ' ')}`);
      });
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Video upload endpoint
app.post("/upload", upload.single("video"), (req, res) => {
  console.log("Video uploaded:", req.file.filename);
  res.json({ success: true, filename: req.file.filename });
});

// Fixed Video streaming endpoint
app.get('/video/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  console.log('Serving video:', req.params.filename, 'Size:', fileSize);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Validate the requested range
    if (start >= fileSize || end >= fileSize) {
      res.status(416).header({
        'Content-Range': `bytes */${fileSize}`
      }).send('Range Not Satisfiable');
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/webm',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/webm',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Get all videos
app.get("/videos", async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      return res.json({ videos: [] });
    }
    
    const files = fs.readdirSync(uploadsDir);
    
    const videoFiles = files.filter(file => 
      file.endsWith('.mp4') || file.endsWith('.webm')
    ).map(file => ({
      filename: file,
      url: `/video/${file}`
    }));
    
    res.json({ videos: videoFiles });
  } catch (err) {
    console.error("Error reading videos:", err);
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof RangeError || error.status === 416) {
    res.status(416).send('Range Not Satisfiable');
  } else {
    next(error);
  }
});

app.listen(8000, () => console.log("✅ Backend running on http://localhost:8000"));