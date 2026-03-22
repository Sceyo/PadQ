# 🎮 PadQ System – Match Manager

A full-stack web application for organizing singles or doubles matches with a fair queue. Winners go to the back, losers to the front – or choose from four different match-making modes.

---

## 🎯 Features

- **Singles / Doubles** – select your preferred game format  
- **Player management** – add 5–24 players with a simple + button and list  
- **Queue modes**:
  - **Default** – winners to back, losers to front (classic)
  - **Randomize** – shuffle the entire queue after every match
  - **Tournament** – knockout bracket, winners advance, champions crowned
  - **Play-all** – prevents the same pairing until all other combinations have been used
- **Match history** – track results with timestamps (hide/show toggle)
- **Dark mode** – sun/moon toggle in the top-right corner
- **Responsive design** – works on mobile, tablet, and desktop
- **Modern UI** – gradient background, pill-shaped buttons, smooth animations

---

## 🛠️ Tech Stack

- **Frontend**: React.js, Axios, React Router  
- **Backend**: Python, Flask, Flask-CORS  
- **Styling**: Custom CSS with CSS variables (light/dark themes)

---

## 🚀 Installation & Setup

### 1. Clone the repository

``bash
git clone https://github.com/your-username/queue-system.git
cd queue-system

### 2. Backend Setup
- cd backend
- python -m venv venv
- source venv/bin/activate      # On Windows: venv\Scripts\activate
- pip install flask flask-cors
- python app.py

The backend will run on:
👉 http://localhost:5000

### 3. Frontend Setup
- cd frontend
- npm install
- npm start

The frontend will open on:
👉 http://localhost:3000

---

## 📖 Usage
- Homepage – choose Singles or Doubles
- Player Input – add names using the + button (min 5, max 24), then press Start
- Queue Mode – select:
  - Default
  - Randomize
  - Tournament
  - Play-all
- ▶️ Playing Matches
  - Singles: Click the winner of the top two players
  - Doubles:
- Assign first four players into teams
- Select the winning team

---

## 📊 Other Features
- Match History – shown on the right (toggle with Hide/Show History)
- Dark Mode – toggle via sun/moon icon
- Tournament Mode – auto-generated bracket, click winners to advance
- Randomize – reshuffle queue or reseed tournament using 🎲 button

---

## 📁 Folder Structure
```bash
queue-system/
├── backend/
│   ├── app.py               # Flask API endpoints
│   └── requirements.txt
└── frontend/
    ├── public/
    ├── src/
    │   ├── App.js
    │   ├── HomePage.js
    │   ├── HomePage.css
    │   ├── QueueSystem.js
    │   ├── QueueSystem.css
    │   └── index.js
    └── package.json
```
---

## 🔌 API Endpoints (Backend)
| Method | Endpoint | Description |
| --- | --- | --- |
| POST	| /api/mode	| Set game mode | 
| POST	| /api/players	| Upload player list |
| GET	| /api/queue	| Get current queue |
| POST	| /api/randomize	| Shuffle queue |
| POST	| /api/match/singles	| Play singles match |
| POST	| /api/match/doubles	| Play doubles match |
