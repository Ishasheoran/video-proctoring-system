import React, { useState, useEffect } from 'react';

function InterviewerDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError('');
      setDebugInfo('Fetching candidates from server...');
      
      const response = await fetch('https://video-proctoring-system-3q6z.onrender.com/candidates');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setDebugInfo(`Received ${data.length} candidates from server`);
      setCandidates(data);
      
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setError('Failed to load candidates. Please check if the server is running.');
      setDebugInfo(`Error: ${error.message}`);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async (candidateId) => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`https://video-proctoring-system-3q6z.onrender.com/report/${candidateId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setReport(data);
      setSelectedCandidate(candidateId);
    } catch (error) {
      console.error('Error fetching report:', error);
      setError('Failed to load report. Please try again.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const viewCandidateVideo = async (candidateId) => {
    try {
      setLoading(true);
      setError('');
      setVideoUrl('');
      
      console.log('🔍 Looking for video for candidate:', candidateId);
      
      // Fetch list of all videos
      const response = await fetch('https://video-proctoring-system-3q6z.onrender.com/videos');
      if (!response.ok) throw new Error('Failed to fetch videos');
      
      const data = await response.json();
      console.log('Available videos:', data.videos);
      
      // Find videos for this candidate - robust search
      const candidateVideos = data.videos.filter(video => {
        const filename = video.filename || video;
        console.log('Checking file:', filename, 'for candidate:', candidateId);
        
        // Extract candidate ID from filename (everything before _interview_)
        const filenameParts = filename.split('_interview_');
        if (filenameParts.length < 2) return false;
        
        const fileCandidateId = filenameParts[0];
        console.log('Extracted candidate ID from filename:', fileCandidateId);
        
        // Case-insensitive comparison
        return fileCandidateId.toLowerCase() === candidateId.toLowerCase();
      });
      
      console.log('Found candidate videos:', candidateVideos);
      
      if (candidateVideos.length === 0) {
        setError(`No video found for candidate ${candidateId}`);
        return;
      }
      
      // Get the most recent video (by timestamp in filename)
      const sortedVideos = candidateVideos.sort((a, b) => {
        const getTimestamp = (videoObj) => {
          const filename = videoObj.filename || videoObj;
          const match = filename.match(/_interview_(\d+)\.webm$/);
          return match ? parseInt(match[1]) : 0;
        };
        return getTimestamp(b) - getTimestamp(a);
      });
      
      const latestVideo = sortedVideos[0];
      const videoFilename = latestVideo.filename || latestVideo;
      
      console.log('Selected video:', videoFilename);
      
      // Use the streaming endpoint
      const videoUrl = `https://video-proctoring-system-3q6z.onrender.com/video/${videoFilename}`;
      console.log('Using video URL:', videoUrl);
      
      setVideoUrl(videoUrl);
      setVideoModalOpen(true);
      
    } catch (error) {
      console.error('Error fetching video:', error);
      setError('Failed to load video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearCandidateData = async (candidateId) => {
    try {
      const response = await fetch(`https://video-proctoring-system-3q6z.onrender.com/candidate/${candidateId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`Cleared data for candidate ${candidateId}`);
        fetchCandidates();
        setReport(null);
        setSelectedCandidate(null);
        setError('Data cleared successfully');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error clearing candidate data:', error);
      setError('Error clearing data. Please try again.');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="interviewer-dashboard">
      <header className="dashboard-header">
        <h1>Interviewer Dashboard</h1>
        <button onClick={fetchCandidates} className="refresh-btn">
          Refresh Candidates
        </button>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="debug-info">
        <small>{debugInfo}</small>
      </div>

      <div className="dashboard-content">
        <div className="candidates-section">
          <h2>Candidates</h2>
          {candidates.length > 0 && (
            <button 
              onClick={() => {
                if (selectedCandidate) {
                  clearCandidateData(selectedCandidate);
                }
              }}
              className="clear-data-btn"
              disabled={!selectedCandidate}
            >
              Clear Selected Candidate Data
            </button>
          )}
          <div className="candidates-list">
            {candidates.length === 0 ? (
              <div className="no-candidates">
                <p>No candidates found</p>
                <button onClick={fetchCandidates} className="retry-btn">
                  Retry Loading Candidates
                </button>
                <div className="troubleshooting">
                  <h4>Troubleshooting:</h4>
                  <ul>
                    <li>Make sure the backend server is running on port 8000</li>
                    <li>Check if the MongoDB connection is working</li>
                    <li>Verify that candidates have been added through the webcam interface</li>
                  </ul>
                </div>
              </div>
            ) : (
              candidates.map(candidate => (
                <div 
                  key={candidate._id || candidate.candidateId} 
                  className={`candidate-item ${selectedCandidate === candidate.candidateId ? 'selected' : ''}`}
                  onClick={() => fetchReport(candidate.candidateId)}
                >
                  <div className="candidate-info">
                    <h4>{candidate.name}</h4>
                    <p>ID: {candidate.candidateId}</p>
                    <p className="interview-date">
                      {candidate.startTime ? new Date(candidate.startTime).toLocaleDateString() : 'No date'}
                    </p>
                  </div>
                  <div className="candidate-status">
                    {candidate.endTime ? (
                      <span className="status-completed">Completed</span>
                    ) : (
                      <span className="status-ongoing">In Progress</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="report-section">
          <h2>Proctoring Report</h2>
          {report ? (
            <div className="report-details">
              <div className="report-header">
                <h3>{report.candidateName}'s Interview Report</h3>
                <div className={`integrity-score ${getScoreColor(report.integrityScore)}`}>
                  <span className="score-label">Integrity Score</span>
                  <span className="score-value">{report.integrityScore}/100</span>
                </div>
              </div>

              <div className="report-stats">
                <div className="stat-item">
                  <span className="stat-label">Interview Duration:</span>
                  <span className="stat-value">{report.interviewDuration}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Events:</span>
                  <span className="stat-value">{report.totalEvents}</span>
                </div>
              </div>

              <div className="events-grid">
                <div className="event-card">
                  <h4>Focus Lost</h4>
                  <span className="event-count">{report.focusLost}</span>
                </div>
                <div className="event-card">
                  <h4>Absence Detected</h4>
                  <span className="event-count">{report.absence}</span>
                </div>
                <div className="event-card">
                  <h4>Multiple Faces</h4>
                  <span className="event-count">{report.multipleFaces}</span>
                </div>
                <div className="event-card">
                  <h4>Phone Detected</h4>
                  <span className="event-count">{report.phoneDetected}</span>
                </div>
                <div className="event-card">
                  <h4>Book Detected</h4>
                  <span className="event-count">{report.bookDetected}</span>
                </div>
                <div className="event-card">
                  <h4>Laptop Detected</h4>
                  <span className="event-count">{report.laptopDetected}</span>
                </div>
              </div>

              <div className="report-actions">
                <a 
                  href={`http://localhost:8000/report/${report.candidateId}/pdf`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="download-btn"
                >
                  Download PDF Report
                </a>
                <button 
                  className="view-video-btn"
                  onClick={() => viewCandidateVideo(report.candidateId)}
                >
                  View Interview Video
                </button>
                <button 
                  className="clear-btn"
                  onClick={() => clearCandidateData(report.candidateId)}
                >
                  Clear This Data
                </button>
              </div>

              {report.logs && report.logs.length > 0 && (
                <div className="event-logs">
                  <h4>Event Logs</h4>
                  <div className="logs-list">
                    {report.logs.slice(0, 10).map((log, index) => (
                      <div key={index} className="log-item">
                        <span className="log-time">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="log-event">{log.eventType}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-report">
              <p>Select a candidate to view their proctoring report</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      {videoModalOpen && (
        <div className="modal-overlay" onClick={() => setVideoModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Interview Recording - {report?.candidateName || 'Candidate'}</h3>
              <button 
                className="close-btn" 
                onClick={() => setVideoModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="video-container">
              {videoUrl ? (
                <video 
                  key={videoUrl}
                  controls 
                  autoPlay 
                  className="candidate-video"
                  onError={(e) => {
                    console.error('Video loading error:', e);
                    console.error('Video source:', videoUrl);
                    setError('Failed to load video. The file may be corrupted or missing.');
                  }}
                  onLoadStart={() => {
                    console.log('Video loading started:', videoUrl);
                    setError('');
                  }}
                  onCanPlay={() => console.log('Video can play')}
                  onPlaying={() => console.log('Video started playing')}
                >
                  <source src={videoUrl} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="video-loading">
                  <p>Loading video...</p>
                </div>
              )}
            </div>
            {error && (
              <div className="video-error">
                <p>{error}</p>
                <button onClick={() => setVideoModalOpen(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InterviewerDashboard;
