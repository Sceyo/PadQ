import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../CSS/Homepage.css';

function HomePage() {
  const navigate = useNavigate();

  const handleModeSelect = (mode) => {
 
    navigate(`/queue/${mode}`);
  };

  return (
    <div className="homepage">
      <h1>Welcome to PADQ</h1>
      <p className="description">
        Organize your singles or doubles matches with a fair queue. Winners are pushed forward while losers are pushed behind. Ensuring fair play and randomize queues.
      </p>
      <div className="mode-buttons">
        <button className="mode-btn singles" onClick={() => handleModeSelect('singles')}>
          Singles Mode
        </button>
        <button className="mode-btn doubles" onClick={() => handleModeSelect('doubles')}>
          Doubles Mode
        </button>
      </div>
    </div>
  );
}

export default HomePage;