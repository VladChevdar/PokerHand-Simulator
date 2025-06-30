// Trading Game State
let gameState = {
    balance: 1000,
    ownedHand: null,
    currentHands: [],
    communityCards: [],
    gameHistory: []
};

// Card validation and display logic
const VALID_RANKS = "23456789TJQKA";
const VALID_SUITS = "HDCS";
const SUIT_SYMBOLS = {
    'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠',
    'h': '♥', 'd': '♦', 'c': '♣', 's': '♠'
};

// Format a card for display (e.g., "AS" becomes "A♠")
function formatCardForDisplay(card) {
    if (!card || card.length !== 2) return '??';
    const rank = card[0];
    const suit = SUIT_SYMBOLS[card[1]] || card[1];
    return `${rank}${suit}`;
}

// Add card image mapping
function getCardImagePath(card) {
    if (!card || card.length !== 2) return '/static/img/cards/PNG/blue_back.png';
    
    let rank = card[0];
    const suit = card[1];
    
    // Handle 10 as a special case
    if (rank === 'T') {
        rank = '10';
    }
    
    // Face cards are uppercase in filenames
    if (['J', 'Q', 'K', 'A'].includes(rank)) {
        return `/static/img/cards/PNG/${rank}${suit}.png`;
    }
    
    // Number cards
    return `/static/img/cards/PNG/${rank}${suit}.png`;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadGameState();
    updateUI();
    // Update slider label on load
    const slider = document.getElementById('num-players-slider');
    const label = document.getElementById('num-players-value');
    if (slider && label) {
        label.textContent = slider.value;
        slider.addEventListener('input', function() {
            label.textContent = slider.value;
        });
    }
});

function setupEventListeners() {
    // Trading game controls
    document.getElementById('generate-hands').addEventListener('click', generateNewHands);
    document.getElementById('reset-game').addEventListener('click', resetGame);
    document.getElementById('next-card-btn').addEventListener('click', nextCommunityCard);
    
    // Simulator controls (keeping original functionality)
    document.getElementById('add-player').addEventListener('click', addPlayer);
    document.getElementById('run-simulation').addEventListener('click', runSimulation);
    
    // Card input listeners for simulator
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('card-input')) {
            handleCardInput(e.target);
        }
    });
    
    // Auto-uppercase and validation for simulator
    document.addEventListener('keyup', function(e) {
        if (e.target.classList.contains('card-input')) {
            e.target.value = e.target.value.toUpperCase();
            validateCard(e.target);
        }
    });
}

// Trading Game Functions
async function loadGameState() {
    try {
        const response = await fetch('/api/game-state');
        const data = await response.json();
        gameState.balance = data.balance;
        gameState.ownedHand = data.owned_hand;
        gameState.gameHistory = data.game_history || [];
        updateUI();
    } catch (error) {
        console.error('Error loading game state:', error);
    }
}

async function generateNewHands() {
    const slider = document.getElementById('num-players-slider');
    const num = slider ? parseInt(slider.value) : 6;
    
    if (isNaN(num) || num < 2 || num > 10) {
        showMessage('Please enter a valid number between 2 and 10', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/generate-hands', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ num_players: num })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }
        
        gameState.currentHands = data.hands;
        gameState.balance = data.balance;
        gameState.communityCards = [];
        gameState.ownedHand = null;
        gameState.gameHistory = data.game_history || gameState.gameHistory;
        updateUI();
        if (data.refund_amount && data.refund_amount > 0) {
            showMessage(`Refunded $${data.refund_amount} for previous hand and generated ${num} new hands!`, 'success');
        } else {
            showMessage(`Generated ${num} random hands! Choose one to buy.`, 'success');
        }
    } catch (error) {
        showMessage('Error generating hands: ' + error.message, 'error');
    }
}

async function buyHand(playerIndex, price) {
    try {
        const response = await fetch('/api/buy-hand', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                player_index: playerIndex, 
                price: price 
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }
        
        gameState.balance = data.balance;
        gameState.ownedHand = data.owned_hand;
        gameState.gameHistory = data.game_history || gameState.gameHistory;
        
        updateUI();
        if (data.refund_amount && data.refund_amount > 0) {
            showMessage(`Refunded $${data.refund_amount} for previous hand and bought Player ${playerIndex + 1}'s hand for $${price}!`, 'success');
        } else {
            showMessage(`Successfully bought Player ${playerIndex + 1}'s hand for $${price}!`, 'success');
        }
    } catch (error) {
        showMessage('Error buying hand: ' + error.message, 'error');
    }
}

async function sellHand() {
    if (gameState.ownedHand === null) {
        showMessage('You don\'t own any hand to sell!', 'error');
        return;
    }
    
    // Use the current dynamic sell price from the hand data
    const ownedHandData = gameState.currentHands[gameState.ownedHand];
    const currentPrice = ownedHandData.sell_price !== undefined ? ownedHandData.sell_price : (ownedHandData.price || 0);
    
    try {
        const response = await fetch('/api/sell-hand', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ current_price: currentPrice })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }
        
        gameState.balance = data.balance;
        gameState.ownedHand = data.owned_hand;
        gameState.gameHistory = data.game_history || gameState.gameHistory;
        
        updateUI();
        showMessage(`Sold your hand for $${currentPrice}!`, 'success');
    } catch (error) {
        showMessage('Error selling hand: ' + error.message, 'error');
    }
}

async function resetGame() {
    if (!confirm('Are you sure you want to reset the game? This will reset your balance and clear all progress.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/reset-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            gameState.balance = data.balance;
            gameState.ownedHand = data.owned_hand;
            gameState.currentHands = [];
            gameState.communityCards = [];
            gameState.gameHistory = [];
            
            updateUI();
            showMessage('Game reset successfully!', 'success');
        }
    } catch (error) {
        showMessage('Error resetting game: ' + error.message, 'error');
    }
}

function calculateCurrentPrice(handData, communityCards) {
    // Simple price adjustment based on board cards
    let price = handData.price;
    
    if (communityCards.length >= 3) {
        // Adjust price based on how many board cards are revealed
        const adjustment = 1 + (communityCards.length - 3) * 0.1;
        price = Math.round(price * adjustment);
    }
    
    return price;
}

function updateUI() {
    // Update balance and owned hand display
    document.getElementById('current-balance').textContent = `$${gameState.balance}`;
    
    if (gameState.ownedHand !== null) {
        const ownedHand = gameState.currentHands[gameState.ownedHand];
        document.getElementById('owned-hand-info').textContent = `Player ${gameState.ownedHand + 1}`;
    } else {
        document.getElementById('owned-hand-info').textContent = 'None';
    }
    
    // Update hands display
    updateHandsDisplay();
    
    // Update board display
    updateCommunityCardsDisplay();
    
    // Update transaction history
    updateTransactionHistory();
    
    // Enable/disable Next Card button
    const nextBtn = document.getElementById('next-card-btn');
    if (gameState.communityCards && gameState.communityCards.length >= 5) {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Board Complete';
    } else if (gameState.ownedHand === null) {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Buy a Hand First';
    } else {
        nextBtn.disabled = false;
        // Set dynamic button text based on board state
        if (gameState.communityCards.length === 0) {
            nextBtn.textContent = 'Deal Flop';
        } else if (gameState.communityCards.length === 3) {
            nextBtn.textContent = 'Deal Turn';
        } else if (gameState.communityCards.length === 4) {
            nextBtn.textContent = 'Deal River';
        }
    }
}

function updateHandsDisplay() {
    const container = document.getElementById('hands-container');
    
    if (gameState.currentHands.length === 0) {
        container.innerHTML = '<p class="no-hands">Click "Generate New Hands" to start trading!</p>';
        return;
    }
    
    container.innerHTML = gameState.currentHands.map((hand, index) => {
        const isOwned = gameState.ownedHand === index;
        const buyPrice = hand.price !== undefined ? hand.price : 0;
        const sellPrice = hand.sell_price !== undefined ? hand.sell_price : (hand.price !== undefined ? hand.price : 0);
        const winProb = hand.probability !== undefined ? hand.probability : 0;
        const strengthPercent = Math.round(winProb);
        
        // Show hand type if available (when community cards are present)
        const handTypeDisplay = hand.hand_type && gameState.communityCards.length >= 3 ? 
            `<div class="hand-type-display">${hand.hand_type.name}</div>` : '';
        
        return `
            <div class="hand-card ${isOwned ? 'owned' : ''}">
                <div class="hand-header">
                    <span class="hand-title">Player ${index + 1}</span>
                    <span class="hand-price">$${isOwned ? sellPrice : buyPrice}</span>
                </div>
                <div class="hand-cards">
                    ${hand.cards.map(card => {
                        const imagePath = getCardImagePath(card);
                        return `<div class="card" style="background-image: url('${imagePath}')" data-card="${card}"></div>`;
                    }).join('')}
                </div>
                ${handTypeDisplay}
                <div class="hand-strength">
                    <span>Strength:</span>
                    <div class="strength-bar">
                        <div class="strength-fill" style="width: ${strengthPercent}%"></div>
                    </div>
                    <span>${strengthPercent}%</span>
                </div>
                <div class="hand-actions">
                    ${isOwned ? 
                        `<button class="btn btn-secondary" onclick="sellHand()">💰 Sell Hand</button>` :
                        `<button class="btn btn-primary" onclick="buyHand(${index}, ${buyPrice})" ${gameState.balance < buyPrice ? 'disabled' : ''}>💳 Buy Hand</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function updateCommunityCardsDisplay() {
    const display = document.getElementById('community-cards-display');
    
    if (!gameState.communityCards || gameState.communityCards.length === 0) {
        display.innerHTML = '<p class="no-community">No community cards yet</p>';
        return;
    }
    
    display.innerHTML = gameState.communityCards.map(card => {
        const imagePath = getCardImagePath(card);
        return `<div class="card" style="background-image: url('${imagePath}')" data-card="${card}"></div>`;
    }).join('');
}

function updateTransactionHistory() {
    const historyContainer = document.getElementById('transaction-history');
    if (!historyContainer) return;

    if (!gameState.gameHistory || gameState.gameHistory.length === 0) {
        historyContainer.innerHTML = '<p class="no-history">No transactions yet</p>';
        return;
    }

    historyContainer.innerHTML = gameState.gameHistory.map(transaction => {
        const getActionIcon = (action) => {
            switch(action) {
                case 'buy': return '💵';
                case 'sell': return '💰';
                case 'refund': return '💸';
                case 'generate': return '🎲';
                default: return '📋';
            }
        };

        const getActionText = (action, player) => {
            switch(action) {
                case 'buy': return `BUY Player ${player}`;
                case 'sell': return `SELL Player ${player}`;
                case 'refund': return `REFUND Player ${player}`;
                case 'generate': return 'GENERATE Hands';
                default: return action;
            }
        };

        return `
            <div class="transaction-item">
                <div class="transaction-left">
                    <div class="transaction-action ${transaction.action.toLowerCase()}">
                        ${getActionIcon(transaction.action)} ${getActionText(transaction.action, transaction.player)}
                    </div>
                </div>
                <div class="transaction-amount">$${transaction.price}</div>
            </div>
        `;
    }).join('');
}

// Utility Functions
function validateCard(input) {
    const value = input.value.trim().toUpperCase();
    
    if (value === '') {
        input.classList.remove('valid', 'invalid');
        return null;
    }
    
    if (value.length !== 2) {
        input.classList.add('invalid');
        input.classList.remove('valid');
        return null;
    }
    
    const rank = value[0];
    const suit = value[1];
    
    if (VALID_RANKS.includes(rank) && VALID_SUITS.includes(suit)) {
        input.classList.add('valid');
        input.classList.remove('invalid');
        return value;
    } else {
        input.classList.add('invalid');
        input.classList.remove('valid');
        return null;
    }
}

function getCardClass(card) {
    const suit = card[1];
    if (suit === 'H' || suit === 'D') {
        return 'hearts diamonds';
    } else {
        return 'spades clubs';
    }
}

function getUnicodeCard(card) {
    const rank = card[0];
    const suit = card[1];
    return rank + SUIT_SYMBOLS[suit];
}

function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = message;
    
    // Insert at the top of the container
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Original Simulator Functions (keeping for the simulator section)
let playerCount = 2;

function handleCardInput(input) {
    input.value = input.value.toUpperCase();
    validateCard(input);
    updateCardDisplays();
}

function updateCardDisplays() {
    // Update player hand displays
    document.querySelectorAll('.player-hand').forEach(playerHand => {
        const display = playerHand.querySelector('.hand-cards');
        const inputs = playerHand.querySelectorAll('.card-input');
        
        display.innerHTML = '';
        inputs.forEach(input => {
            const card = validateCard(input);
            if (card) {
                const imagePath = getCardImagePath(card);
                const cardElement = document.createElement('div');
                cardElement.className = 'card';
                cardElement.style.backgroundImage = `url('${imagePath}')`;
                cardElement.setAttribute('data-card', card);
                display.appendChild(cardElement);
            }
        });
    });
    
    // Update community cards display
    const communityDisplay = document.querySelector('.community-display');
    const communityInputs = document.querySelectorAll('.community-cards .card-input');
    
    communityDisplay.innerHTML = '';
    communityInputs.forEach(input => {
        const card = validateCard(input);
        if (card) {
            const imagePath = getCardImagePath(card);
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.style.backgroundImage = `url('${imagePath}')`;
            cardElement.setAttribute('data-card', card);
            communityDisplay.appendChild(cardElement);
        }
    });
}

function createCardElement(cardStr) {
    const div = document.createElement('div');
    div.className = 'card';
    
    if (cardStr && cardStr.length === 2) {
        const imagePath = getCardImagePath(cardStr);
        div.style.backgroundImage = `url('${imagePath}')`;
        div.setAttribute('data-card', cardStr);
    } else {
        div.className = 'card-placeholder';
        div.textContent = '?';
    }
    
    return div;
}

function addPlayer() {
    if (playerCount >= 10) {
        showMessage('Maximum 10 players allowed', 'error');
        return;
    }
    
    playerCount++;
    const playerHand = document.createElement('div');
    playerHand.className = 'player-hand';
    playerHand.dataset.player = playerCount;
    
    playerHand.innerHTML = `
        <div class="player-header">
            <h3>Player ${playerCount}</h3>
            <button class="remove-player" onclick="removePlayer(this)">×</button>
        </div>
        <div class="card-inputs">
            <input type="text" class="card-input" placeholder="e.g., AH" maxlength="2" data-card="1">
            <input type="text" class="card-input" placeholder="e.g., KS" maxlength="2" data-card="2">
        </div>
        <div class="hand-cards"></div>
    `;
    
    document.getElementById('player-hands').appendChild(playerHand);
    
    // Add event listeners to new inputs
    playerHand.querySelectorAll('.card-input').forEach(input => {
        input.addEventListener('input', () => handleCardInput(input));
    });
}

function removePlayer(button) {
    const playerHand = button.closest('.player-hand');
    const playerHands = document.getElementById('player-hands');
    
    if (playerHands.children.length <= 2) {
        showMessage('Minimum 2 players required', 'error');
        return;
    }
    
    playerHand.remove();
    playerCount--;
    
    // Renumber remaining players
    document.querySelectorAll('.player-hand').forEach((hand, index) => {
        hand.setAttribute('data-player', index + 1);
        hand.querySelector('h3').textContent = `Player ${index + 1}`;
    });
}

function collectPlayerHands() {
    const hands = [];
    document.querySelectorAll('.player-hand').forEach(playerHand => {
        const inputs = playerHand.querySelectorAll('.card-input');
        const hand = [];
        
        inputs.forEach(input => {
            const card = validateCard(input);
            if (card) {
                hand.push(card);
            }
        });
        
        if (hand.length === 2) {
            hands.push(hand);
        }
    });
    
    return hands;
}

function collectCommunityCards() {
    const cards = [];
    document.querySelectorAll('.community-cards .card-input').forEach(input => {
        const card = validateCard(input);
        if (card) {
            cards.push(card);
        }
    });
    
    return cards;
}

async function runSimulation() {
    const playerHands = collectPlayerHands();
    const communityCards = collectCommunityCards();
    const simulations = parseInt(document.getElementById('simulations').value);
    
    if (playerHands.length < 2) {
        showMessage('Need at least 2 players with valid hands', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('/simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                player_hands: playerHands,
                community_cards: communityCards,
                simulations: simulations
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }
        
        displayResults(data);
    } catch (error) {
        showMessage('Error running simulation: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    const contentDiv = document.getElementById('results-content');
    
    contentDiv.innerHTML = `
        <div class="results-summary">
            <h3>Simulation Results (${data.community_cards.length === 0 ? 'Pre-flop' : 'With community cards'})</h3>
            ${data.player_hands.map((hand, index) => {
                const handType = data.hand_types && data.hand_types[index] ? data.hand_types[index].name : 'Unknown';
                const handCards = hand.map(card => {
                    const imagePath = getCardImagePath(card);
                    return `<div class="card" style="background-image: url('${imagePath}')" data-card="${card}"></div>`;
                }).join('');
                
                return `
                    <div class="probability-bar">
                        <div class="player-info">
                            <span class="player-label">Player ${index + 1}:</span>
                            <div class="hand-cards">
                                ${handCards}
                            </div>
                        </div>
                        <div class="probability-info">
                            <div class="probability-fill" style="--width: ${data.probabilities[index]}%"></div>
                            <span class="probability-value">${data.probabilities[index]}%</span>
                            <span class="hand-type">${handType}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    resultsDiv.style.display = 'block';
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Add random buttons to initial players
function addRandomButtonsToInitialPlayers() {
    document.querySelectorAll('.player-hand').forEach((hand, index) => {
        if (index < 2) {
            const header = hand.querySelector('.player-header');
            const randomBtn = document.createElement('button');
            randomBtn.className = 'random-player';
            randomBtn.textContent = '🎲 Random';
            randomBtn.onclick = function() { randomizePlayerHand(this); };
            header.appendChild(randomBtn);
        }
    });
}

function getAllUsedCards(excludeInputs = []) {
    const used = new Set();
    
    // Collect from all player hands
    document.querySelectorAll('.player-hand .card-input').forEach(input => {
        if (!excludeInputs.includes(input)) {
            const card = validateCard(input);
            if (card) used.add(card);
        }
    });
    
    // Collect from community cards
    document.querySelectorAll('.community-cards .card-input').forEach(input => {
        if (!excludeInputs.includes(input)) {
            const card = validateCard(input);
            if (card) used.add(card);
        }
    });
    
    return used;
}

function getRandomCard(used) {
    const ranks = VALID_RANKS;
    const suits = VALID_SUITS;
    
    let attempts = 0;
    while (attempts < 100) {
        const rank = ranks[Math.floor(Math.random() * ranks.length)];
        const suit = suits[Math.floor(Math.random() * suits.length)];
        const card = rank + suit;
        
        if (!used.has(card)) {
            return card;
        }
        attempts++;
    }
    
    return null;
}

function randomizePlayerHand(button) {
    const playerHand = button.closest('.player-hand');
    const inputs = playerHand.querySelectorAll('.card-input');
    const used = getAllUsedCards(Array.from(inputs));
    
    inputs.forEach(input => {
        const card = getRandomCard(used);
        if (card) {
            input.value = card;
            used.add(card);
            validateCard(input);
        }
    });
    
    updateCardDisplays();
}

async function nextCommunityCard() {
    if (gameState.ownedHand === null) {
        showMessage('You must buy a hand before dealing board cards!', 'error');
        return;
    }
    try {
        const response = await fetch('/api/next-community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.error) {
            showMessage(data.error, 'error');
            return;
        }
        gameState.communityCards = data.community_cards;
        
        // Update hand data with new prices and probabilities
        if (data.hands && Array.isArray(data.hands)) {
            for (let i = 0; i < data.hands.length; i++) {
                if (i < gameState.currentHands.length) {
                    gameState.currentHands[i].price = data.hands[i].price;
                    gameState.currentHands[i].sell_price = data.hands[i].sell_price || data.hands[i].price;
                    gameState.currentHands[i].probability = data.hands[i].probability;
                    if (data.hands[i].hand_type) {
                        gameState.currentHands[i].hand_type = data.hands[i].hand_type;
                    }
                }
            }
        }
        
        updateUI();
        if (gameState.communityCards.length === 3) {
            showMessage('Flop dealt!', 'success');
        } else if (gameState.communityCards.length === 4) {
            showMessage('Turn dealt!', 'success');
        } else if (gameState.communityCards.length === 5) {
            showMessage('River dealt!', 'success');
        }
    } catch (error) {
        showMessage('Error dealing board card: ' + error.message, 'error');
    }
}

async function updateHandPrices() {
    try {
        const response = await fetch('/api/hand-prices');
        const data = await response.json();
        if (data.buy_prices && Array.isArray(data.buy_prices)) {
            for (let i = 0; i < gameState.currentHands.length; i++) {
                gameState.currentHands[i].price = data.buy_prices[i];
                gameState.currentHands[i].sell_price = data.sell_prices[i];
                gameState.currentHands[i].probability = data.probabilities[i];
            }
        }
    } catch (error) {
        // Ignore price update errors for now
    }
}