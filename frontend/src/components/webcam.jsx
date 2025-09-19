import React, { useRef, useEffect, useState } from "react";
import * as mpFaceDetection from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

function CombinedDetection() {
  const videoRef = useRef(null);
  const lastEvents = useRef({ focus: null, absence: null, object: null, multiple_faces: null });
  const [candidateName, setCandidateName] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [status, setStatus] = useState("Please enter your name to begin");
  const [detections, setDetections] = useState([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // ✅ Send logs to backend
  const sendLog = async (eventType) => {
    const now = Date.now();
    const lastEventTime = lastEvents.current[eventType] || 0;
    const cooldown = eventType === "absence_detected" ? 10000 : 5000;

    if (now - lastEventTime > cooldown) {
      lastEvents.current[eventType] = now;
      try {
        await fetch("http://localhost:8000/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateId: candidateName,
            eventType,
            timestamp: new Date(),
          }),
        });
        console.log(`✅ Log sent: ${eventType}`);
      } catch (err) {
        console.error("Error sending log:", err);
      }
    }
  };

  // ✅ Handle form submit
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!candidateName.trim()) return alert("Please enter your name");
    setShowForm(false);
    setTimeout(initializeCamera, 100);
  };

  //  Initialize camera + recording
  const initializeCamera = async () => {
    setStatus("Requesting camera permission...");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);

      const videoEl = videoRef.current;
      videoEl.srcObject = mediaStream;
      await videoEl.play();
      setStatus("Recording in progress...");

      setupMediaRecorder(mediaStream);
      initializeFaceDetection();
      initializeObjectDetection();
    } catch (err) {
      console.error(err);
      setStatus("Error accessing camera: " + err.message);
    }
  };

  //  MediaRecorder setup
  const setupMediaRecorder = (mediaStream) => {
    const recordedChunks = [];
    let recorder;

    try {
      recorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
    } catch (err) {
      console.warn("Fallback MediaRecorder:", err);
      recorder = new MediaRecorder(mediaStream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      console.log("Blob size:", blob.size);

      if (blob.size === 0) {
        console.error(" Recording failed: empty blob");
        setStatus("Recording failed, please try again");
        return;
      }

      const formData = new FormData();
      const filename = `${candidateName}_interview_${Date.now()}.webm`;
      formData.append("video", blob, filename);

      try {
        const response = await fetch("http://localhost:8000/upload", {
          method: "POST",
          body: formData,
        });
        if (response.ok) console.log("✅ Video uploaded:", filename);
        else console.error(" Failed to upload video");
      } catch (err) {
        console.error("Error uploading video:", err);
      }
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setStatus("Recording...");

    // Notify backend interview started
    fetch("http://localhost:8000/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: candidateName, name: candidateName }),
    }).catch((err) => console.error("Error starting interview:", err));
  };

  //  Stop recording
  const stopRecording = async () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setStatus("Recording stopped");

      // Notify backend interview ended
      try {
        await fetch("http://localhost:8000/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: candidateName }),
        });
      } catch (err) {
        console.error(err);
      }

      if (stream) stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setMediaRecorder(null);
      setChunks([]);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  //  Face Detection
  const initializeFaceDetection = () => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoEl.srcObject) return;

    const faceDetection = new mpFaceDetection.FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    faceDetection.setOptions({ model: "short", minDetectionConfidence: 0.5 });

    faceDetection.onResults((results) => {
      const now = Date.now();
      if (!results.detections || results.detections.length === 0) {
        setStatus("No face detected");
        sendLog("focus_lost");
        sendLog("absence_detected");
        setDetections([]);
      } else {
        if (results.detections.length > 1) sendLog("multiple_faces");
        setStatus("Recording - Face detected");
      }
    });

    const camera = new Camera(videoEl, {
      onFrame: async () => await faceDetection.send({ image: videoEl }),
      width: 640,
      height: 480,
    });
    camera.start();
  };

  // ✅ Object Detection
  const initializeObjectDetection = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoEl.srcObject) return;

    try {
      const model = await cocoSsd.load();
      const interval = setInterval(async () => {
        if (videoEl.readyState !== 4) return;
        const predictions = await model.detect(videoEl);
        const suspicious = predictions.filter((p) =>
          ["cell phone", "book", "laptop"].includes(p.class) && p.score > 0.7
        );
        if (suspicious.length > 0) {
          sendLog(`${suspicious[0].class}_detected`);
          setDetections(suspicious);
          setStatus("⚠️ Suspicious item detected");
        } else setDetections(predictions);
      }, 3000);
      return () => clearInterval(interval);
    } catch (err) {
      console.error(err);
      setStatus("Object detection error");
    }
  };

  return (
    <div className="detection-container">
      <h2>Smart Detection & Recording System</h2>
      {showForm ? (
        <form onSubmit={handleFormSubmit}>
          <label>Your Name:</label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            required
            placeholder="Enter full name"
          />
          <button type="submit">Start Interview</button>
        </form>
      ) : (
        <>
          <div className="video-wrapper">
            <video ref={videoRef} autoPlay muted playsInline width={640} height={480} />
            <div className="status-overlay">{status}</div>
          </div>
          {detections.length > 0 && (
            <div className="detections">
              <h3>Detections:</h3>
              <ul>
                {detections.map((d, i) => (
                  <li key={i}>
                    {d.class} ({(d.score * 100).toFixed(1)}% confidence)
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={stopRecording}>
            🛑 Stop Interview
          </button>
        </>
      )}
    </div>
  );
}

export default CombinedDetection;
