# 🃏 Poker Hand Simulator

A modern web application for calculating win probabilities in Texas Hold'em poker hands using Monte Carlo simulation.

## Features

- **Interactive Web Interface**: Beautiful, responsive design with real-time card validation
- **Multiple Players**: Support for 2-6 players
- **Community Cards**: Optional flop, turn, and river cards
- **Real-time Validation**: Instant feedback on card input validity
- **Visual Results**: Probability bars and card displays with Unicode symbols
- **Configurable Simulations**: Choose from 1,000 to 100,000 simulations for accuracy vs speed

## Installation

1. **Clone or download the project files**

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   python app.py
   ```

4. **Open your browser** and go to `http://localhost:5000`

## How to Use

### Card Format
- Use 2-character format: **Rank + Suit**
- **Ranks**: 2-9, T (10), J, Q, K, A
- **Suits**: H (♥), D (♦), C (♣), S (♠)

### Examples
- `AH` = Ace of Hearts ♥
- `KS` = King of Spades ♠
- `TD` = 10 of Diamonds ♦
- `2C` = 2 of Clubs ♣

### Steps
1. **Enter Player Hands**: Each player needs exactly 2 cards
2. **Add Community Cards** (optional): Flop, turn, and river cards
3. **Choose Simulation Count**: More simulations = more accurate results
4. **Run Simulation**: Click the button to calculate win probabilities

### Features
- **Add/Remove Players**: Dynamic player management (2-6 players)
- **Real-time Validation**: Cards are validated as you type
- **Duplicate Detection**: Prevents using the same card twice
- **Visual Feedback**: Cards display with proper suit symbols and colors

## Technical Details

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Poker Engine**: Treys library for hand evaluation
- **Simulation**: Monte Carlo method with configurable iterations

## File Structure

```
PokerHands/
├── app.py              # Flask application
├── main.py             # Original command-line version
├── main2.py            # Enhanced command-line version
├── requirements.txt    # Python dependencies
├── README.md          # This file
├── templates/
│   └── index.html     # Main HTML template
└── static/
    ├── css/
    │   └── style.css  # Stylesheets
    └── js/
        └── script.js  # JavaScript functionality
```

## API Endpoints

- `GET /` - Main application page
- `POST /simulate` - Run poker simulation
  - Request body: `{"player_hands": [["AH", "KS"], ["QD", "JC"]], "community_cards": [], "simulations": 10000}`
  - Response: `{"probabilities": [65.2, 34.8], "player_hands": [...], "community_cards": [...]}`

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

This project is open source and available under the MIT License. 

.cards {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px; /* optional: space between cards */
} 