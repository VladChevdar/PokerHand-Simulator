from flask import Flask, render_template, request, jsonify, session
import random
from treys import Card, Deck, Evaluator
import json
from datetime import datetime
import os
import tempfile

app = Flask(__name__)
app.secret_key = 'poker_trading_game_secret_key'

# Use standard Flask sessions but with a larger cookie limit
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max content
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Map short input like "8H" to proper treys format "8h", and Unicode output
SUIT_SYMBOLS = {'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠', 'h': '♥', 'd': '♦', 'c': '♣', 's': '♠'}
VALID_RANKS = "23456789TJQKA"
VALID_SUITS = "shdc"

# Game constants
STARTING_BALANCE = 1000
TRANSACTION_FEE_FLAT = 0  # No fee on buy
GENERATE_HANDS_FEE = 10
FEE = 0  # No buy/sell fee anymore

# Hand rank names for display (treys library uses 1=best, 9=worst)
HAND_RANKS = {
    1: "Straight Flush",
    2: "Four of a Kind",
    3: "Full House",
    4: "Flush",
    5: "Straight",
    6: "Three of a Kind",
    7: "Two Pair",
    8: "Pair",
    9: "High Card"
}

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

def calculate_hand_strength(hand):
    """Calculate initial hand strength (0-100) for pricing"""
    evaluator = Evaluator()
    
    # Create a simple strength calculation based on card ranks
    rank_values = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 
                   'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
    
    card1, card2 = hand[0], hand[1]
    rank1, rank2 = card1[0], card2[0]
    suit1, suit2 = card1[1], card2[1]
    
    # Base strength from card values
    strength = (rank_values[rank1] + rank_values[rank2]) / 2
    
    # Bonus for suited cards
    if suit1 == suit2:
        strength += 10
    
    # Bonus for pairs
    if rank1 == rank2:
        strength += 20
    
    # Bonus for high cards
    if rank1 in ['A', 'K', 'Q', 'J'] or rank2 in ['A', 'K', 'Q', 'J']:
        strength += 5
    
    # Bonus for connected cards
    rank1_val = rank_values[rank1]
    rank2_val = rank_values[rank2]
    if abs(rank1_val - rank2_val) <= 2:
        strength += 5
    
    return min(100, max(0, strength))

def calculate_hand_price(strength, community_cards=[]):
    """Calculate hand price based on strength and community cards"""
    base_price = 50 + (strength * 2)  # Base price: 50-250
    
    # Adjust price based on community cards
    if len(community_cards) >= 3:  # Flop or later
        adjustment = 1 + (len(community_cards) - 3) * 0.1
        base_price = round(base_price * adjustment)
    
    return int(base_price)

def validate_session_state():
    """Validate and clean up session state if needed"""
    if 'balance' not in session:
        session['balance'] = STARTING_BALANCE
    if 'owned_hand' not in session:
        session['owned_hand'] = None
    if 'game_history' not in session:
        session['game_history'] = []
    if 'leverage' not in session:
        session['leverage'] = 1
    
    # Clean up orphaned state
    hands = session.get('hands', [])
    owned_hand = session.get('owned_hand')
    
    if owned_hand is not None and (not hands or owned_hand >= len(hands)):
        session['owned_hand'] = None
        
    # Limit game history to last 20 transactions to reduce session size
    if len(session.get('game_history', [])) > 20:
        session['game_history'] = session['game_history'][-20:]
        
    return True

def simulate_win_probabilities(player_hands, community_cards=[], simulations=10000):
    num_players = len(player_hands)
    wins = [0] * num_players

    evaluator = Evaluator()
    
    # Convert cards from uppercase format (AH) to treys format (Ah)
    player_hands_eval = []
    for hand in player_hands:
        hand_eval = []
        for card in hand:
            # Convert 'AH' -> 'Ah' for treys
            card_treys = card[0] + card[1].lower()
            hand_eval.append(Card.new(card_treys))
        player_hands_eval.append(hand_eval)
    
    community_eval = []
    for card in community_cards:
        # Convert 'AH' -> 'Ah' for treys
        card_treys = card[0] + card[1].lower()
        community_eval.append(Card.new(card_treys))

    known_cards = [card for hand in player_hands_eval for card in hand] + community_eval
    remaining_cards_needed = 5 - len(community_cards)

    # If all community cards are dealt, just evaluate the hands once
    if remaining_cards_needed == 0:
        scores = [evaluator.evaluate(hand, community_eval) for hand in player_hands_eval]
        best = min(scores)
        winners = [i for i, score in enumerate(scores) if score == best]
        for w in winners:
            wins[w] = simulations / len(winners)
    else:
        # Run simulations for remaining unknown cards
        for _ in range(simulations):
            deck = Deck()
            # Remove known cards from deck - create new list instead of removing from existing
            remaining_deck = []
            for card_obj in deck.cards:
                if card_obj not in known_cards:
                    remaining_deck.append(card_obj)
            
            # Draw only the remaining unknown cards from the filtered deck
            if len(remaining_deck) >= remaining_cards_needed:
                random.shuffle(remaining_deck)
                simulated_board = community_eval + remaining_deck[:remaining_cards_needed]
            else:
                # Fallback if not enough cards (shouldn't happen in normal play)
                simulated_board = community_eval

            scores = [
                evaluator.evaluate(hand, simulated_board)
                for hand in player_hands_eval
            ]
            best = min(scores)
            winners = [i for i, score in enumerate(scores) if score == best]
            for w in winners:
                wins[w] += 1 / len(winners)

    return [round(w / simulations * 100, 2) for w in wins]

def normalize_card(card):
    # Converts 'AH' -> 'Ah', 'TD' -> 'Td', etc.
    rank = card[0].upper()
    suit = card[1].lower()
    return rank + suit

def generate_random_hands(num_players=6):
    """Generate random hands for the trading game"""
    deck = Deck()
    hands = []
    
    for _ in range(num_players):
        hand = []
        for _ in range(2):
            card = deck.draw(1)[0]
            # Convert to uppercase format for frontend (e.g., 'AH' instead of 'Ah')
            card_str = Card.int_to_str(card).upper()
            hand.append(card_str)
        hands.append(hand)
    
    return hands

@app.route('/')
def index():
    # Initialize and validate session state
    validate_session_state()
    return render_template('index.html', balance=session['balance'])

@app.route('/api/game-state')
def get_game_state():
    """Get current game state including balance and owned hand"""
    validate_session_state()
    return jsonify({
        'balance': session.get('balance', STARTING_BALANCE),
        'owned_hand': session.get('owned_hand'),
        'game_history': session.get('game_history', []),
        'leverage': session.get('leverage', 1)
    })

@app.route('/api/generate-hands', methods=['POST'])
def generate_hands():
    """Generate random hands for trading and initialize deck and community cards in session. Subtract $10 fee and refund current hand."""
    data = request.get_json()
    num_players = data.get('num_players', 6)
    
    try:
        # Validate session state first
        validate_session_state()
        
        balance = int(session.get('balance', STARTING_BALANCE))
        current_owned_hand = session.get('owned_hand')
        
        # If user already owns a hand, refund the previous hand at its current sell price * leverage used for that hand
        refund_amount = 0
        if current_owned_hand is not None:
            prev_hand_index = current_owned_hand
            prev_hands = session.get('hands', [])
            # Find the leverage used for the previous hand from transaction history
            prev_leverage = 1
            for transaction in reversed(session.get('game_history', [])):
                if transaction['action'] == 'buy' and transaction['player'] == prev_hand_index + 1:
                    prev_leverage = transaction.get('leverage', 1)
                    break
            if prev_hand_index is not None and prev_hand_index < len(prev_hands):
                prev_hand = prev_hands[prev_hand_index]
                prev_sell_price = get_dynamic_hand_prices_and_probs()[1][prev_hand_index]
                refund_amount = prev_sell_price * prev_leverage
                session['balance'] += refund_amount
                # Add refund transaction
                game_history = session.get('game_history', [])
                game_history.append({
                    'action': 'refund',
                    'player': prev_hand_index + 1,
                    'price': refund_amount,
                    'balance': session['balance'],
                    'timestamp': datetime.now().isoformat(),
                    'leverage': prev_leverage
                })
                session['game_history'] = game_history
        
        # Calculate total cost (fee - refund)
        total_cost = GENERATE_HANDS_FEE - refund_amount
        
        if balance < total_cost:
            return jsonify({'error': 'Insufficient funds for $10 fee'}), 400
        
        session['balance'] = balance - total_cost
        
        # Add transaction to history with timestamp
        game_history = session.get('game_history', [])
        timestamp = datetime.now().isoformat()
        
        game_history.append({
            'action': 'generate',
            'player': None,
            'price': GENERATE_HANDS_FEE,
            'balance': balance - total_cost,
            'timestamp': timestamp
        })
        
        session['game_history'] = game_history
        
        hands = generate_random_hands(num_players)
        
        # Store hands and community cards in session first (needed for consistent pricing)
        session['hands'] = hands
        session['community_cards'] = []
        
        # Use the same consistent pricing function
        buy_prices, sell_prices, probabilities = get_dynamic_hand_prices_and_probs()
        hand_data = []
        
        for i, hand in enumerate(hands):
            hand_data.append({
                'player': i + 1,
                'cards': hand,
                'strength': calculate_hand_strength(hand),
                'price': buy_prices[i] if i < len(buy_prices) else 0,
                'sell_price': sell_prices[i] if i < len(sell_prices) else 0,
                'probability': probabilities[i] if i < len(probabilities) else 0,
                'hand_type': get_hand_type([hand], [])[0]
            })
        
        # Store deck for auto dealing
        deck = Deck()
        used_cards = []
        # Convert all used cards to treys format for proper comparison
        for hand in hands:
            for card in hand:
                # Convert 'AH' -> 'Ah' for treys format
                treys_card = card[0] + card[1].lower()
                used_cards.append(treys_card)
        
        # Remove used cards from deck (deck.cards contains Card objects)
        remaining_cards = []
        for card_obj in deck.cards:
            card_str = Card.int_to_str(card_obj)
            if card_str not in used_cards:
                remaining_cards.append(card_obj)
        
        deck.cards = remaining_cards
        session['deck'] = [Card.int_to_str(c).upper() for c in deck.cards]  # Store in uppercase
        session['owned_hand'] = None  # Reset owned hand
        
        return jsonify({
            'hands': hand_data,
            'balance': session['balance'],
            'owned_hand': session['owned_hand'],
            'game_history': game_history,
            'refund_amount': refund_amount if refund_amount > 0 else None
        })
        
    except Exception as e:
        print(f"Error in generate_hands: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/buy-hand', methods=['POST'])
def buy_hand():
    data = request.get_json()
    player_index = data.get('player_index')
    price = data.get('price')
    
    try:
        validate_session_state()
        
        if not session.get('hands'):
            return jsonify({'error': 'No hands available. Please generate hands first.'}), 400
            
        hands = session.get('hands', [])
        if player_index >= len(hands):
            return jsonify({'error': 'Invalid hand selected.'}), 400
            
        if session.get('owned_hand') is not None:
            return jsonify({'error': 'You already own a hand. Sell it first.'}), 400
        
        balance = session.get('balance', STARTING_BALANCE)
        leverage = session.get('leverage', 1)
        
        # Calculate the actual cost (leveraged amount)
        # With 2x leverage on a $50 hand, you pay $100
        leveraged_cost = price * leverage
        
        if balance < leveraged_cost:
            return jsonify({'error': 'Insufficient funds'}), 400
        
        session['balance'] = balance - leveraged_cost
        session['owned_hand'] = player_index
        
        # Get hand details and current state
        hands = session.get('hands', [])
        community_cards = session.get('community_cards', [])
        _, _, probabilities = get_dynamic_hand_prices_and_probs()
        
        # Get hand type if community cards exist
        hand_type = None
        if community_cards:
            hand_types = get_hand_type([hands[player_index]], community_cards)
            hand_type = hand_types[0]['name'] if hand_types else None
        
        # Add transaction to history with timestamp and additional info
        game_history = session.get('game_history', [])
        game_history.append({
            'action': 'buy',
            'player': player_index + 1,
            'price': leveraged_cost,
            'balance': balance - leveraged_cost,
            'timestamp': datetime.now().isoformat(),
            'leverage': leverage,
            'leveraged_cost': leveraged_cost
        })
        session['game_history'] = game_history
        
        return jsonify({
            'success': True,
            'balance': int(session['balance']),
            'owned_hand': session['owned_hand'],
            'game_history': game_history,
            'leverage': leverage,
            'transaction': {
                'action': 'buy',
                'player': player_index + 1,
                'price': leveraged_cost,
                'leverage': leverage,
                'leveraged_cost': leveraged_cost,
                'fee': 0  # No fee
            }
        })
    except Exception as e:
        print(f"Error in buy_hand: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/sell-hand', methods=['POST'])
def sell_hand():
    data = request.get_json()
    current_price = data.get('current_price', 0)
    
    try:
        balance = session.get('balance', STARTING_BALANCE)
        owned_hand = session.get('owned_hand')
        hands = session.get('hands', [])
        
        if owned_hand is None:
            return jsonify({'error': 'No hand owned'}), 400
            
        if not hands or owned_hand >= len(hands):
            return jsonify({'error': 'Invalid hand state. Please generate new hands.'}), 400
        
        # Get hand details and current state
        hands = session.get('hands', [])
        community_cards = session.get('community_cards', [])
        _, _, probabilities = get_dynamic_hand_prices_and_probs()
        
        # Get hand type
        hand_types = get_hand_type([hands[owned_hand]], community_cards)
        hand_type = hand_types[0]['name'] if hand_types else None
        
        # Find the buy price and leverage from history to calculate profit/loss
        buy_price = None
        buy_leverage = 1
        for transaction in reversed(session.get('game_history', [])):
            if transaction['action'] == 'buy' and transaction['player'] == owned_hand + 1:
                buy_price = transaction['price']
                buy_leverage = transaction.get('leverage', 1)
                break
        
        # Calculate leveraged profit/loss and actual payout
        if buy_price is not None:
            # Profit/Loss is difference times leverage
            base_profit_loss = current_price - buy_price
            leveraged_profit_loss = base_profit_loss * buy_leverage
            # User receives the current price multiplied by leverage (they paid price*leverage when buying)
            actual_payout = current_price * buy_leverage
        else:
            leveraged_profit_loss = None
            actual_payout = current_price * buy_leverage
        
        session['balance'] = balance + actual_payout
        session['owned_hand'] = None
        
        # Add transaction to history with timestamp and additional info
        game_history = session.get('game_history', [])
        game_history.append({
            'action': 'sell',
            'player': owned_hand + 1,
            'price': current_price,
            'balance': balance + actual_payout,
            'timestamp': datetime.now().isoformat(),
            'leverage': buy_leverage,
            'leveraged_profit_loss': leveraged_profit_loss,
            'actual_payout': actual_payout
        })
        session['game_history'] = game_history
        
        return jsonify({
            'success': True,
            'balance': int(session['balance']),
            'owned_hand': session['owned_hand'],
            'game_history': game_history,
            'leverage': buy_leverage,
            'transaction': {
                'action': 'sell',
                'player': owned_hand + 1,
                'price': current_price,
                'leverage': buy_leverage,
                'leveraged_profit_loss': leveraged_profit_loss,
                'actual_payout': actual_payout,
                'fee': 0
            }
        })
    except Exception as e:
        print(f"Error in sell_hand: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/set-leverage', methods=['POST'])
def set_leverage():
    """Set leverage multiplier (1x to 10x)"""
    data = request.get_json()
    leverage = data.get('leverage', 1)
    
    try:
        validate_session_state()
        
        leverage = int(leverage)
        if leverage < 1 or leverage > 10:
            return jsonify({'error': 'Leverage must be between 1x and 10x'}), 400
        
        # Don't allow changing leverage while owning a hand
        if session.get('owned_hand') is not None:
            return jsonify({'error': 'Cannot change leverage while owning a hand'}), 400
        
        session['leverage'] = leverage
        
        return jsonify({
            'success': True,
            'leverage': session['leverage']
        })
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid leverage value'}), 400

@app.route('/api/reset-game', methods=['POST'])
def reset_game():
    """Reset the game state"""
    # Clear all session data
    session.clear()
    
    # Reinitialize with defaults
    validate_session_state()
    
    return jsonify({
        'success': True,
        'balance': session['balance'],
        'owned_hand': session['owned_hand'],
        'leverage': session['leverage']
    })

@app.route('/simulate', methods=['POST'])
def simulate():
    data = request.get_json()
    player_hands = data.get('player_hands', [])
    community_cards = data.get('community_cards', [])
    simulations = data.get('simulations', 10000)
    
    # Normalize all cards
    try:
        player_hands = [[normalize_card(card) for card in hand] for hand in player_hands]
        community_cards = [normalize_card(card) for card in community_cards]
    except Exception as e:
        return jsonify({'error': f'Invalid card format: {e}'}), 400
    
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
        hand_types = get_hand_type(player_hands, community_cards)
        return jsonify({
            'probabilities': probabilities,
            'hand_types': hand_types,
            'player_hands': player_hands,
            'community_cards': community_cards
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_most_recent_buy_price(player_index):
    """Get the most recent buy price for a specific player from transaction history"""
    history = session.get('game_history', [])
    
    # Look for the most recent 'buy' transaction for this player
    for transaction in reversed(history):
        if transaction['action'] == 'buy' and transaction['player'] == player_index + 1:
            return transaction['price']
    
    # If no buy transaction found, return None
    return None

def get_dynamic_hand_prices_and_probs():
    hands = session.get('hands', [])
    community_cards = session.get('community_cards', [])
    if not hands:
        return [], [], []
    probabilities = simulate_win_probabilities(hands, community_cards, simulations=2000)
    
    # Check if game is over (all 5 community cards dealt)
    if len(community_cards) == 5:
        # Game is over - winners split $100 based on their probabilities
        buy_prices = []
        sell_prices = []
        for p in probabilities:
            # Each player gets their share of the $100 pot based on win probability
            # e.g. if two players tie, they each get $50 (probability 50%)
            price = int(round(p))  # probability is already in percentage
            buy_prices.append(price)
            sell_prices.append(price)
    else:
        # Game is still in progress - add deterministic price variation based on hand+board
        buy_prices = []
        sell_prices = []
        for i, p in enumerate(probabilities):
            # Create deterministic variation based on hand cards + community cards
            # This ensures prices are consistent for the same game state
            hand_str = ''.join(hands[i]) + ''.join(community_cards)
            hash_val = hash(hand_str) % 1000
            # Convert hash to variation between -20% and +20%
            variation = (hash_val / 1000.0 - 0.5) * 0.4  # -0.2 to +0.2
            adjusted_price = p * (1 + variation)
            # Cap the price at $99 until river is dealt, then $100 when all community cards are dealt
            max_price = 99  # Cap at $99 until river is dealt
            capped_price = max(1, min(max_price, int(round(adjusted_price))))  # Ensure minimum price of $1
            buy_prices.append(capped_price)
            sell_prices.append(capped_price)
    
    return buy_prices, sell_prices, probabilities

@app.route('/api/hand-prices')
def hand_prices():
    """Return current hand prices and win probabilities"""
    validate_session_state()
    
    if not session.get('hands'):
        return jsonify({'buy_prices': [], 'sell_prices': [], 'probabilities': []})
        
    buy_prices, sell_prices, probabilities = get_dynamic_hand_prices_and_probs()
    return jsonify({'buy_prices': buy_prices, 'sell_prices': sell_prices, 'probabilities': probabilities})

@app.route('/api/next-community', methods=['POST'])
def next_community():
    """Deal next community card(s) and update hand values"""
    try:
        # Validate session state
        if not session.get('hands'):
            return jsonify({'error': 'No hands available. Please generate hands first.'}), 400
            
        if session.get('owned_hand') is None:
            return jsonify({'error': 'Must own a hand to see community cards'}), 400
        
        deck = session.get('deck', [])
        community_cards = session.get('community_cards', [])
        
        if len(community_cards) >= 5:
            return jsonify({'error': 'All community cards are already dealt'}), 400
            
        if not deck:
            return jsonify({'error': 'No cards left in deck. Please generate new hands.'}), 400
        
        # Deal appropriate number of cards
        if len(community_cards) == 0:
            # Deal flop (3 cards)
            new_cards = deck[:3]
            deck = deck[3:]
        else:
            # Deal turn or river (1 card)
            new_cards = deck[:1]
            deck = deck[1:]
        
        # Update session
        community_cards.extend(new_cards)  # Cards are already in uppercase from generate_hands
        session['deck'] = deck
        session['community_cards'] = community_cards
        
        # Get updated prices and probabilities using the same function as hand-prices endpoint
        hands = session.get('hands', [])
        buy_prices, sell_prices, probabilities = get_dynamic_hand_prices_and_probs()
        
        hand_data = []
        for i, hand in enumerate(hands):
            # Get hand type if we have at least 3 community cards
            hand_type = None
            if len(community_cards) >= 3:
                hand_type = get_hand_type([hand], community_cards)[0]
            
            hand_data.append({
                'player': i + 1,
                'cards': hand,
                'strength': calculate_hand_strength(hand),
                'price': buy_prices[i] if i < len(buy_prices) else 0,
                'sell_price': sell_prices[i] if i < len(sell_prices) else 0,
                'probability': probabilities[i] if i < len(probabilities) else 0,
                'hand_type': hand_type
            })
        
        return jsonify({
            'hands': hand_data,
            'community_cards': community_cards,
            'balance': session.get('balance'),
            'owned_hand': session.get('owned_hand')
        })
        
    except Exception as e:
        print(f"Error in next_community: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def get_hand_type(player_hands, community_cards):
    """Get the hand type/rank for each player based on their current best 5-card hand"""
    evaluator = Evaluator()
    hand_types = []
    
    for hand in player_hands:
        # Convert cards from uppercase format (AH) to treys format (Ah)
        hand_eval = []
        for card in hand:
            card_treys = card[0] + card[1].lower()
            hand_eval.append(Card.new(card_treys))
        
        community_eval = []
        for card in community_cards:
            card_treys = card[0] + card[1].lower()
            community_eval.append(Card.new(card_treys))
        
        if len(community_cards) >= 3:
            # Post-flop (at least 3 community cards) – use treys evaluator for full 5-card analysis
            try:
                hand_score = evaluator.evaluate(hand_eval, community_eval)
                hand_rank = evaluator.get_rank_class(hand_score)
                hand_name = HAND_RANKS.get(hand_rank, "Unknown")
            except Exception:
                hand_name = "High Card"
        else:
            # Pre-flop – only 2 hole cards available. Classify basic categories.
            rank1, rank2 = hand[0][0], hand[1][0]
            if rank1 == rank2:
                hand_name = "Pair"
            else:
                hand_name = "High Card"
        
        hand_types.append({
            'name': hand_name
        })
    
    return hand_types

if __name__ == '__main__':
    app.run(debug=True, port=8081) 