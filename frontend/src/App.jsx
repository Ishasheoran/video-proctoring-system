import React, { useState } from 'react';
import CombinedDetection from './components/webcam';
import InterviewerDashboard from './components/interviewer';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('candidate');

  return (
    <div className="App">
      <nav className="app-nav">
        <button 
          onClick={() => setCurrentView('candidate')}
          className={currentView === 'candidate' ? 'active' : ''}
        >
          Candidate View
        </button>
        <button 
          onClick={() => setCurrentView('interviewer')}
          className={currentView === 'interviewer' ? 'active' : ''}
        >
          Interviewer Dashboard
        </button>
      </nav>

      {currentView === 'candidate' ? <CombinedDetection /> : <InterviewerDashboard />}
    </div>
  );
}

export default App;
