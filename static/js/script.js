// Card validation and display logic
const VALID_RANKS = "23456789TJQKA";
const VALID_SUITS = "HDCS";
const SUIT_SYMBOLS = {'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠'};

let playerCount = 2;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateCardDisplays();
});

function setupEventListeners() {
    // Add player button
    document.getElementById('add-player').addEventListener('click', addPlayer);
    
    // Run simulation button
    document.getElementById('run-simulation').addEventListener('click', runSimulation);
    
    // Card input listeners
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('card-input')) {
            handleCardInput(e.target);
        }
    });
    
    // Auto-uppercase and validation
    document.addEventListener('keyup', function(e) {
        if (e.target.classList.contains('card-input')) {
            e.target.value = e.target.value.toUpperCase();
            validateCard(e.target);
        }
    });
}

function validateCard(input) {
    const value = input.value.trim();
    
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

function handleCardInput(input) {
    validateCard(input);
    updateCardDisplays();
}

function updateCardDisplays() {
    // Update player hand displays
    document.querySelectorAll('.player-hand').forEach(playerHand => {
        const display = playerHand.querySelector('.card-display');
        const inputs = playerHand.querySelectorAll('.card-input');
        
        display.innerHTML = '';
        inputs.forEach(input => {
            const card = validateCard(input);
            if (card) {
                display.appendChild(createCardElement(card));
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
            communityDisplay.appendChild(createCardElement(card));
        }
    });
}

function createCardElement(cardStr) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const rank = cardStr[0];
    const suit = cardStr[1];
    const suitSymbol = SUIT_SYMBOLS[suit];
    
    // Add suit class for styling
    if (suit === 'H' || suit === 'D') {
        card.classList.add('hearts', 'diamonds');
    } else {
        card.classList.add('spades', 'clubs');
    }
    
    card.textContent = rank + suitSymbol;
    return card;
}

function addPlayer() {
    if (playerCount >= 6) {
        showMessage('Maximum 6 players allowed', 'error');
        return;
    }
    
    playerCount++;
    const playerHands = document.getElementById('player-hands');
    const newPlayer = document.createElement('div');
    newPlayer.className = 'player-hand';
    newPlayer.setAttribute('data-player', playerCount);
    
    newPlayer.innerHTML = `
        <div class="player-header">
            <h3>Player ${playerCount}</h3>
            <button class="remove-player" onclick="removePlayer(this)">×</button>
        </div>
        <div class="card-inputs">
            <input type="text" class="card-input" placeholder="e.g., AH" maxlength="2" data-card="1">
            <input type="text" class="card-input" placeholder="e.g., KS" maxlength="2" data-card="2">
        </div>
        <div class="card-display"></div>
    `;
    
    playerHands.appendChild(newPlayer);
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

function validateInputs() {
    const playerHands = collectPlayerHands();
    
    if (playerHands.length < 2) {
        showMessage('Need at least 2 valid players (each with 2 cards)', 'error');
        return false;
    }
    
    // Check for duplicate cards
    const allCards = [];
    playerHands.forEach(hand => allCards.push(...hand));
    
    const communityCards = collectCommunityCards();
    allCards.push(...communityCards);
    
    const uniqueCards = new Set(allCards);
    if (allCards.length !== uniqueCards.size) {
        showMessage('Duplicate cards detected. Each card can only be used once.', 'error');
        return false;
    }
    
    return true;
}

function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(messageDiv, mainContent.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('run-simulation').disabled = true;
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('run-simulation').disabled = false;
}

function displayResults(data) {
    const resultsSection = document.getElementById('results');
    const resultsContent = document.getElementById('results-content');
    
    resultsContent.innerHTML = '';
    
    // Display player hands
    const handsDiv = document.createElement('div');
    handsDiv.innerHTML = '<h3>Player Hands:</h3>';
    data.player_hands.forEach((hand, index) => {
        const handDisplay = hand.map(card => {
            const rank = card[0];
            const suit = card[1];
            const suitSymbol = SUIT_SYMBOLS[suit];
            const suitClass = (suit === 'H' || suit === 'D') ? 'hearts diamonds' : 'spades clubs';
            return `<span class="card ${suitClass}">${rank}${suitSymbol}</span>`;
        }).join('');
        handsDiv.innerHTML += `<p><strong>Player ${index + 1}:</strong> ${handDisplay}</p>`;
    });
    resultsContent.appendChild(handsDiv);
    
    // Display community cards if any
    if (data.community_cards.length > 0) {
        const communityDiv = document.createElement('div');
        communityDiv.innerHTML = '<h3>Community Cards:</h3>';
        const communityDisplay = data.community_cards.map(card => {
            const rank = card[0];
            const suit = card[1];
            const suitSymbol = SUIT_SYMBOLS[suit];
            const suitClass = (suit === 'H' || suit === 'D') ? 'hearts diamonds' : 'spades clubs';
            return `<span class="card ${suitClass}">${rank}${suitSymbol}</span>`;
        }).join('');
        communityDiv.innerHTML += `<p>${communityDisplay}</p>`;
        resultsContent.appendChild(communityDiv);
    }
    
    // Display probabilities
    const probabilitiesDiv = document.createElement('div');
    probabilitiesDiv.innerHTML = '<h3>Win Probabilities:</h3>';
    
    data.probabilities.forEach((prob, index) => {
        const barDiv = document.createElement('div');
        barDiv.className = 'probability-bar';
        barDiv.innerHTML = `
            <div class="probability-fill" style="width: ${prob}%"></div>
            <div class="probability-text">Player ${index + 1}: ${prob}%</div>
        `;
        probabilitiesDiv.appendChild(barDiv);
    });
    
    resultsContent.appendChild(probabilitiesDiv);
    resultsSection.style.display = 'block';
}

async function runSimulation() {
    if (!validateInputs()) {
        return;
    }
    
    const playerHands = collectPlayerHands();
    const communityCards = collectCommunityCards();
    const simulations = parseInt(document.getElementById('simulations').value);
    
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
        
        if (response.ok) {
            displayResults(data);
        } else {
            showMessage(data.error || 'An error occurred during simulation', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
        console.error('Error:', error);
    } finally {
        hideLoading();
    }
} 