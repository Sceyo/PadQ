import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '../src/Pages/Homepage';
import QueueSystem from '../src/Pages/QueueSystem';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/queue/:mode" element={<QueueSystem />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;