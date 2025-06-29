from flask import Flask, render_template, request, jsonify
import random
from treys import Card, Deck, Evaluator

app = Flask(__name__)

# Map short input like "8H" to proper treys format "8h", and Unicode output
SUIT_SYMBOLS = {'s': '♠', 'h': '♥', 'd': '♦', 'c': '♣'}
VALID_RANKS = "23456789TJQKA"
VALID_SUITS = "shdc"

def parse_card(card_str):
    card_str = card_str.strip().upper()
    if len(card_str) != 2:
        return None
    rank, suit = card_str[0], card_str[1].lower()
    if rank not in VALID_RANKS or suit not in VALID_SUITS:
        return None
    return rank + suit

def get_unicode_card(card):
    rank, suit = card[0], card[1]
    return f"{rank}{SUIT_SYMBOLS[suit]}"

def simulate_win_probabilities(player_hands, community_cards=[], simulations=10000):
    num_players = len(player_hands)
    wins = [0] * num_players

    evaluator = Evaluator()
    player_hands_eval = [[Card.new(card) for card in hand] for hand in player_hands]
    community_eval = [Card.new(card) for card in community_cards]

    known_cards = [card for hand in player_hands_eval for card in hand] + community_eval

    for _ in range(simulations):
        deck = Deck()
        for card in known_cards:
            deck.cards.remove(card)
        simulated_board = community_eval + deck.draw(5 - len(community_eval))

        scores = [
            evaluator.evaluate(hand, simulated_board)
            for hand in player_hands_eval
        ]
        best = min(scores)
        winners = [i for i, score in enumerate(scores) if score == best]
        for w in winners:
            wins[w] += 1 / len(winners)

    return [round(w / simulations * 100, 2) for w in wins]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.get_json()
    player_hands = data.get('player_hands', [])
    community_cards = data.get('community_cards', [])
    simulations = data.get('simulations', 10000)
    
    # Validate input
    if len(player_hands) < 2:
        return jsonify({'error': 'Need at least 2 players'}), 400
    
    # Check for duplicate cards
    all_cards = []
    for hand in player_hands:
        all_cards.extend(hand)
    all_cards.extend(community_cards)
    
    if len(all_cards) != len(set(all_cards)):
        return jsonify({'error': 'Duplicate cards detected'}), 400
    
    try:
        probabilities = simulate_win_probabilities(player_hands, community_cards, simulations)
        return jsonify({
            'probabilities': probabilities,
            'player_hands': player_hands,
            'community_cards': community_cards
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080) 