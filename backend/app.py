from flask import Flask, request, jsonify
from flask_cors import CORS
import random

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from React frontend

# Game state
game_mode = None          # 'singles' or 'doubles'
players = []              # list of player names
queue = []                # current queue order

@app.route('/')
def home():
    return jsonify({"message": "Queue System API is running"})

# Helper functions (your queue logic from earlier)
def init_queue():
    global queue
    queue = players.copy()
    random.shuffle(queue)

def play_singles(winner_name):
    global queue
    if len(queue) < 2:
        return False, "Not enough players for singles"
    player1, player2 = queue[0], queue[1]
    # Remove first two
    queue.pop(0)
    queue.pop(0)
    # Determine loser
    loser = player2 if winner_name == player1 else player1
    # Loser to front, winner to back
    queue.insert(0, loser)
    queue.append(winner_name)
    return True, queue

def play_doubles(team_a, team_b, winning_team):  # winning_team = 'A' or 'B'
    global queue
    if len(queue) < 4:
        return False, "Not enough players for doubles"
    # Get first four
    match_players = queue[:4]
    # Remove them
    queue = queue[4:]
    # Determine winners and losers
    if winning_team == 'A':
        winners = team_a
        losers = team_b
    else:
        winners = team_b
        losers = team_a
    # Losers to front (order preserved)
    for loser in losers:
        queue.insert(0, loser)
    # Winners to back
    for winner in winners:
        queue.append(winner)
    return True, queue

# API endpoints

@app.route('/api/mode', methods=['POST'])
def set_mode():
    global game_mode
    data = request.get_json()
    mode = data.get('mode')
    if mode not in ['singles', 'doubles']:
        return jsonify({'error': 'Invalid mode'}), 400
    game_mode = mode
    return jsonify({'mode': game_mode})

@app.route('/api/players', methods=['POST'])
def set_players():
    global players, queue
    data = request.get_json()
    new_players = data.get('players', [])
    if not (5 <= len(new_players) <= 24):
        return jsonify({'error': 'Number of players must be between 5 and 24'}), 400
    players = new_players
    init_queue()  # Randomize initial queue
    return jsonify({'players': players, 'queue': queue})

@app.route('/api/queue', methods=['GET'])
def get_queue():
    return jsonify({'queue': queue, 'mode': game_mode})

@app.route('/api/match/singles', methods=['POST'])
def match_singles():
    if game_mode != 'singles':
        return jsonify({'error': 'Not in singles mode'}), 400
    data = request.get_json()
    winner = data.get('winner')
    if winner not in queue[:2]:
        return jsonify({'error': 'Winner must be one of the current players'}), 400
    success, result = play_singles(winner)
    if not success:
        return jsonify({'error': result}), 400
    return jsonify({'queue': result})

@app.route('/api/match/doubles', methods=['POST'])
def match_doubles():
    if game_mode != 'doubles':
        return jsonify({'error': 'Not in doubles mode'}), 400
    data = request.get_json()
    team_a = data.get('teamA')
    team_b = data.get('teamB')
    winning_team = data.get('winningTeam')  # 'A' or 'B'
    # Validate that the four players are exactly the first four in queue
    if len(queue) < 4:
        return jsonify({'error': 'Not enough players for doubles'}), 400
    first_four = queue[:4]
    if set(team_a + team_b) != set(first_four):
        return jsonify({'error': 'Teams must consist of the first four players in queue'}), 400
    success, result = play_doubles(team_a, team_b, winning_team)
    if not success:
        return jsonify({'error': result}), 400
    return jsonify({'queue': result})

@app.route('/api/randomize', methods=['POST'])
def randomize_queue():
    global queue
    if not players:
        return jsonify({'error': 'No players set'}), 400
    init_queue()
    return jsonify({'queue': queue})

if __name__ == '__main__':
    app.run(debug=True, port=5000)