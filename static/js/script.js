// Trading Game State
let gameState = {
    balance: 500,
    ownedHand: null,
    currentHands: [],
    communityCards: [],
    gameHistory: [],
    sessionProfit: 0,               // Track profit for current trading session (computed dynamically)
    sessionStartBalance: 0,         // Balance after last "Generate Hands" action
    previousPrices: []              // Track previous prices for animation
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
    if (!card || card.length !== 2) return 'static/img/cards/PNG/blue_back.png';
    
    let rank = card[0];
    const suit = card[1];
    
    // Handle 10 as a special case
    if (rank === 'T') {
        rank = '10';
    }
    
    // Face cards are uppercase in filenames
    if (['J', 'Q', 'K', 'A'].includes(rank)) {
        return `static/img/cards/PNG/${rank}${suit}.png`;
    }
    
    // Number cards
    return `static/img/cards/PNG/${rank}${suit}.png`;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Reset simulation slider to default value
    const simulationsSlider = document.getElementById('simulations');
    const simulationsValue = document.getElementById('simulations-value');
    if (simulationsSlider && simulationsValue) {
        simulationsSlider.value = 5000;
        simulationsValue.textContent = '10,000';
    }
    
    // Add direct event listener for download button
    const downloadBtn = document.getElementById('download-history');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            downloadTransactionHistory();
        });
    }
    
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

    // Add event listeners for player hand inputs
    document.querySelectorAll('.player-hand .card-input').forEach(input => {
        input.addEventListener('input', function() {
            updateCardDisplays();
        });
    });

    // Add event listeners for community card inputs
    document.querySelectorAll('.community-card').forEach(input => {
        input.addEventListener('input', function() {
            updateCardDisplays();
        });
    });

    // Download button is handled in setupEventListeners()
    
    // Check scroll overflow on window resize
    window.addEventListener('resize', checkScrollOverflow);
    
    // Initial check for simulator scroll overflow
    checkSimulatorScrollOverflow();
});

function setupEventListeners() {
    // Trading game controls
    document.getElementById('generate-hands').addEventListener('click', generateNewHands);
    // Attach reset game listener if the element exists (some layouts use balance display instead)
    const resetBtn = document.getElementById('reset-game');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetGame);
    }
    document.getElementById('next-card-btn').addEventListener('click', nextCommunityCard);
    
    // Simulator controls (keeping original functionality)
    document.getElementById('add-player').addEventListener('click', addPlayer);
    document.getElementById('run-simulation').addEventListener('click', runSimulation);
    
    // Simulation slider
    const simulationsSlider = document.getElementById('simulations');
    const simulationsValue = document.getElementById('simulations-value');
    simulationsSlider.addEventListener('input', function() {
        simulationsValue.textContent = Number(this.value).toLocaleString();
    });
    
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

    // Add event listener for clear simulator button
    document.getElementById('clear-simulator').addEventListener('click', function() {
        // Clear all player hand inputs and their card displays
        const playerHands = document.querySelectorAll('.player-hand');
        playerHands.forEach(playerHand => {
            // Clear inputs
            const inputs = playerHand.querySelectorAll('.card-input');
            inputs.forEach(input => {
                input.value = '';
            });
            
            // Clear card images
            const handCards = playerHand.querySelector('.hand-cards');
            if (handCards) {
                handCards.innerHTML = '';
            }
            
            // Clear inline results
            const handResults = playerHand.querySelector('.hand-results');
            if (handResults) {
                handResults.remove();
            }
        });
        
        // Clear all community card inputs and their displays
        const communityInputs = document.querySelectorAll('.community-card');
        communityInputs.forEach(input => {
            input.value = '';
        });
        
        // Clear community card display
        const communityDisplay = document.querySelector('.community-display');
        if (communityDisplay) {
            communityDisplay.remove();
        }
        
        // Clear results if they exist
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
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
        if (!gameState.sessionStartBalance) {
            gameState.sessionStartBalance = data.balance;
        }
        updateUI();
    } catch (error) {
        console.error('Error loading game state:', error);
    }
}

async function generateNewHands() {
    console.log('generateNewHands called - ownedHand:', gameState.ownedHand, 'communityCards length:', gameState.communityCards.length);
    // Prevent generating new hands while still owning one UNLESS the game is over OR the hand is worth $0
    const ownedHandValue = gameState.ownedHand !== null ? 
        (gameState.currentHands[gameState.ownedHand]?.sell_price || gameState.currentHands[gameState.ownedHand]?.price || 0) : 0;
    
    if (gameState.ownedHand !== null && gameState.communityCards.length < 5 && ownedHandValue > 0) {
        console.log('Blocked from generating new hands - still own hand and game not over');
        showMessage('Please sell your current hand before generating new ones', 'error');
        return;
    }
    console.log('Proceeding with generating new hands');

    const slider = document.getElementById('num-players-slider');
    const num = slider ? parseInt(slider.value) : 3;
    
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
        
        // Baseline should be balance BEFORE the $10 generate fee so that session profit starts at -10
        gameState.sessionStartBalance = data.balance + 10;
        gameState.sessionProfit = 0;
        
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
        
        // Don't update session profit on buy - will be calculated when cards are dealt
        
        updateUI();
        if (data.refund_amount && data.refund_amount > 0) {
            showMessage(`Refunded $${data.refund_amount} for previous hand and bought Hand ${playerIndex + 1} for $${price}!`, 'success');
        } else {
            showMessage(`Successfully bought Hand ${playerIndex + 1} for $${price}!`, 'success');
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
        gameState.ownedHand = data.owned_hand; // Should be null after selling
        console.log('After selling - ownedHand:', gameState.ownedHand, 'communityCards length:', gameState.communityCards.length);
        gameState.gameHistory = data.game_history || gameState.gameHistory;
        
        // Final profit is already tracked through price changes during community cards
        // No need to add anything here as the profit from price changes is already in sessionProfit
        
        updateUI();
        if (currentPrice > 0) {
            showMessage(`Successfully sold hand for $${currentPrice}!`, 'success');
        } else {
            showMessage(`Hand sold for $0 - better luck next time!`, 'success');
        }
    } catch (error) {
        showMessage('Error selling hand: ' + error.message, 'error');
    }
}

// Make functions globally accessible for testing
window.testDownload = function() {
    console.log('Testing download function...');
    downloadTransactionHistory(true);
};

window.debugGameState = function() {
    console.log('Current game state:', gameState);
    console.log('Download button element:', document.getElementById('download-history'));
    const btn = document.getElementById('download-history');
    if (btn) {
        console.log('Button found. Onclick:', btn.onclick);
        console.log('Button event listeners:', getEventListeners ? getEventListeners(btn) : 'getEventListeners not available');
    }
};

async function resetGame() {
    if (!confirm('Are you sure you want to reset the balance? This will reset all of your transactions!')) {
        return;
    }
    
    try {
        const response = await fetch('/api/reset-game', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset game');
        }
        
        const data = await response.json();
        
        // Reset game state
        gameState.balance = data.balance;
        gameState.ownedHand = null;
        gameState.currentHands = [];
        gameState.communityCards = [];
        gameState.gameHistory = [];
        gameState.sessionProfit = 0; // Reset session profit to 0
        gameState.sessionStartBalance = data.balance;
        
        // Clear UI
        document.getElementById('hands-container').innerHTML = '<p class="no-hands">Click "Generate New Hands" to start trading!</p>';
        document.getElementById('community-cards-display').innerHTML = '<p class="no-community">No board cards yet</p>';
        document.getElementById('transaction-history').innerHTML = '<p class="no-history">No transactions yet</p>';
        
        // Update UI
        updateUI();
        
        // Show success message
        showMessage('Game reset successfully!', 'success');
        
    } catch (error) {
        console.error('Error resetting game:', error);
        showMessage('Failed to reset game', 'error');
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
    // Update balance display
    document.getElementById('current-balance').textContent = `$${gameState.balance}`;
    
    // Dynamically calculate current session profit: (balance + value of owned hand) - sessionStartBalance
    let ownedValue = 0;
    if (gameState.ownedHand !== null && gameState.currentHands[gameState.ownedHand]) {
        const ownedHandData = gameState.currentHands[gameState.ownedHand];
        ownedValue = ownedHandData.sell_price !== undefined ? ownedHandData.sell_price : (ownedHandData.price || 0);
    }
    const currentProfit = (gameState.balance + ownedValue) - gameState.sessionStartBalance;
    gameState.sessionProfit = currentProfit; // Keep in state for debugging

    const profitDisplay = document.getElementById('session-profit');
    const profitText = currentProfit >= 0 ? `+$${currentProfit}` : `-$${Math.abs(currentProfit)}`;
    profitDisplay.textContent = profitText;
    profitDisplay.className = `session-profit ${currentProfit >= 0 ? 'profit' : 'loss'}`;
    
    // Clear any text in game-state-left
    document.querySelector('.game-state-left').textContent = '';
    
    // Update hands display
    updateHandsDisplay();
    
    // Update board display
    updateCommunityCardsDisplay();
    
    // Update transaction history
    updateTransactionHistory();
    
    // Enable/disable Generate New Hands button based on hand ownership
    const generateBtn = document.getElementById('generate-hands');
    let ownedHandValueForBtn = 0;
    if (gameState.ownedHand !== null && gameState.currentHands[gameState.ownedHand]) {
        const hData = gameState.currentHands[gameState.ownedHand];
        ownedHandValueForBtn = hData.sell_price !== undefined ? hData.sell_price : (hData.price || 0);
    }
    if (gameState.ownedHand !== null && ownedHandValueForBtn > 0 && gameState.communityCards.length < 5) {
        generateBtn.disabled = true;
        generateBtn.title = 'Sell your current hand before generating new ones';
    } else {
        generateBtn.disabled = false;
        generateBtn.title = 'Generate new hands to trade';
    }
    
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

function updateHandsDisplay(animatePrices = false) {
    const handsContainer = document.getElementById('hands-container');
    if (!gameState.currentHands || gameState.currentHands.length === 0) {
        handsContainer.innerHTML = '<p class="no-hands">Click "Generate New Hands" to start trading!</p>';
        gameState.previousPrices = [];
        return;
    }

    handsContainer.innerHTML = '';
    
    // Find the highest probability when all cards are dealt
    let maxProbability = 0;
    let winningHandsCount = 0;
    if (gameState.communityCards.length === 5) {
        maxProbability = Math.max(...gameState.currentHands.map(h => h.probability));
        winningHandsCount = gameState.currentHands.filter(h => h.probability === maxProbability).length;
    }
    
    gameState.currentHands.forEach((hand, index) => {
        const isOwned = gameState.ownedHand === index;
        const isWinning = gameState.communityCards.length === 5 && hand.probability === maxProbability;
        const isDraw = isWinning && winningHandsCount > 1;
        
        const handElement = document.createElement('div');
        // Set classes in specific order: base class, owned, winning, draw
        const classes = ['hand-card'];
        if (isOwned) classes.push('owned');
        if (isWinning) classes.push('winning');
        if (isDraw) classes.push('draw');
        handElement.className = classes.join(' ');
        
        // Determine price change for animation
        let priceChangeClass = '';
        let sellPriceChangeClass = '';
        if (animatePrices && gameState.previousPrices[index]) {
            const previousPrice = gameState.previousPrices[index].price;
            const previousSellPrice = gameState.previousPrices[index].sellPrice;
            const currentPrice = hand.price;
            const currentSellPrice = hand.sell_price || hand.price;
            
            if (currentPrice > previousPrice) {
                priceChangeClass = 'price-increase';
            } else if (currentPrice < previousPrice) {
                priceChangeClass = 'price-decrease';
            }
            
            if (currentSellPrice > previousSellPrice) {
                sellPriceChangeClass = 'sell-price-increase';
            } else if (currentSellPrice < previousSellPrice) {
                sellPriceChangeClass = 'sell-price-decrease';
            }
        }
        
        handElement.innerHTML = `
            <div class="hand-header">
                <span class="hand-title">Hand ${index + 1}</span>
                <span class="hand-price ${priceChangeClass}">$${hand.price}</span>
            </div>
            <div class="hand-cards">
                ${hand.cards.map(card => `
                    <img class="card-image" src="${getCardImagePath(card)}" alt="${formatCardForDisplay(card)}" title="${formatCardForDisplay(card)}">
                `).join('')}
            </div>
            <div class="hand-strength">
                <span class="strength-label">Strength</span>
                <div class="strength-bar">
                    <div class="strength-fill" style="width: ${hand.probability || 0}%"></div>
                </div>
            </div>
            <div class="hand-actions">
                ${isOwned ? 
                    `<button class="btn btn-warning ${sellPriceChangeClass}" onclick="sellHand()" ${gameState.communityCards.length === 5 ? 'disabled' : ''}>
                        ${gameState.communityCards.length === 5 ? 'Game Complete' : `Sell for $${hand.sell_price}`}
                    </button>` :
                    `<button class="btn btn-primary" onclick="buyHand(${index}, ${hand.price})" ${gameState.ownedHand !== null || gameState.communityCards.length === 5 ? 'disabled' : ''}>
                        ${gameState.communityCards.length === 5 ? 'Game Complete' : `Buy for $${hand.price}`}
                    </button>`
                }
            </div>
        `;
        
        handsContainer.appendChild(handElement);
        
        // Remove animation classes after animation completes
        if (priceChangeClass) {
            setTimeout(() => {
                const priceElement = handElement.querySelector('.hand-price');
                if (priceElement) {
                    priceElement.classList.remove('price-increase', 'price-decrease');
                }
            }, 1200);
        }
        
        if (sellPriceChangeClass) {
            setTimeout(() => {
                const sellButton = handElement.querySelector('.btn-warning');
                if (sellButton) {
                    sellButton.classList.remove('sell-price-increase', 'sell-price-decrease');
                }
            }, 1000);
        }
    });
    
    // Store current prices for next comparison
    gameState.previousPrices = gameState.currentHands.map(hand => ({
        price: hand.price,
        sellPrice: hand.sell_price || hand.price
    }));
    
    // Check for horizontal overflow and update scroll fade effect
    checkScrollOverflow();
}

function checkScrollOverflow() {
    const wrapper = document.getElementById('hands-scroll-wrapper');
    const container = document.getElementById('hands-container');
    
    if (wrapper && container) {
        // Check if the content overflows horizontally
        const hasOverflow = container.scrollWidth > container.clientWidth;
        
        if (hasOverflow) {
            wrapper.classList.add('has-overflow');
        } else {
            wrapper.classList.remove('has-overflow');
        }
    }
    
    // Also check simulator scroll overflow
    checkSimulatorScrollOverflow();
}

function checkSimulatorScrollOverflow() {
    const wrapper = document.getElementById('simulator-hands-scroll-wrapper');
    const container = document.getElementById('player-hands');
    
    if (wrapper && container) {
        // Check if the content overflows horizontally
        const hasOverflow = container.scrollWidth > container.clientWidth;
        
        if (hasOverflow) {
            wrapper.classList.add('has-overflow');
        } else {
            wrapper.classList.remove('has-overflow');
        }
    }
}

function updateCommunityCardsDisplay(animateNewCards = false, previousCardCount = 0) {
    const display = document.getElementById('community-cards-display');
    
    if (!gameState.communityCards || gameState.communityCards.length === 0) {
        display.innerHTML = '<p class="no-community">No community cards yet</p>';
        return;
    }
    
    if (animateNewCards) {
        // Clear the display if we're dealing the flop (first cards)
        if (previousCardCount === 0) {
            display.innerHTML = '';
        }
        
        // Animate only the new cards
        gameState.communityCards.forEach((card, index) => {
            if (index >= previousCardCount) {
                // This is a new card, add it with animation
                const cardElement = document.createElement('div');
                cardElement.className = 'card deal-animation';
                // Start with card back - actual card image will be set during animation
                cardElement.style.backgroundImage = `url('/static/img/cards/PNG/blue_back.png')`;
                cardElement.setAttribute('data-card', card);
                
                // Add specific animation classes based on position
                if (previousCardCount === 0) {
                    // Flop cards (first 3)
                    cardElement.classList.add(`flop-${index + 1}`);
                } else if (previousCardCount === 3) {
                    // Turn card
                    cardElement.classList.add('turn');
                } else if (previousCardCount === 4) {
                    // River card
                    cardElement.classList.add('river');
                }
                
                display.appendChild(cardElement);
                
                // Switch to actual card image at the right moment (when card flips)
                setTimeout(() => {
                    cardElement.style.backgroundImage = `url('${getCardImagePath(card)}')`;
                }, 480); // 60% of 800ms animation
                
                // Remove animation class after animation completes
                setTimeout(() => {
                    cardElement.classList.remove('deal-animation', 'flop-1', 'flop-2', 'flop-3', 'turn', 'river');
                }, 800);
            }
        });
    } else {
        // No animation, just display all cards
        display.innerHTML = gameState.communityCards.map(card => {
            const imagePath = getCardImagePath(card);
            return `<div class="card" style="background-image: url('${imagePath}')" data-card="${card}"></div>`;
        }).join('');
    }
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
                case 'buy': return `BUY Hand ${player}`;
                case 'sell': return `SELL Hand ${player}`;
                case 'refund': return `REFUND Hand ${player}`;
                case 'generate': return 'GENERATE Hands';
                default: return action;
            }
        };

        const timestamp = transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : '';

        return `
            <div class="transaction-item">
                <div class="transaction-left">
                    <div class="transaction-action ${transaction.action.toLowerCase()}">
                        ${getActionIcon(transaction.action)} ${getActionText(transaction.action, transaction.player)}
                    </div>
                    <div class="transaction-time" style="font-size: 0.8em; color: #666;">
                        ${timestamp}
                    </div>
                </div>
                <div class="transaction-amount ${transaction.action.toLowerCase() === 'sell' || transaction.action.toLowerCase() === 'refund' ? 'positive' : 'negative'}">
                    ${transaction.action.toLowerCase() === 'sell' || transaction.action.toLowerCase() === 'refund' ? '+' : '-'}$${transaction.price}
                </div>
            </div>
        `;
    }).join('');
}

function downloadTransactionHistory(testMode = false) {
    if (!gameState.gameHistory || gameState.gameHistory.length === 0) {
        showMessage('No transactions to download. Generate hands and make some trades first!', 'error');
        return;
    }

    try {
        const csvContent = gameState.gameHistory.map((transaction, index) => {
            const timestamp = transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'N/A';
            const action = transaction.action.toUpperCase();
            const hand = transaction.player || '-';
            const amount = transaction.action === 'sell' || transaction.action === 'refund' ? 
                `+$${transaction.price}` : 
                `-$${transaction.price}`;
            const balance = `$${transaction.balance}`;
            return `"${timestamp}","${action}","${hand}","${amount}","${balance}"`;
        }).join('\n');

        const finalCsvContent = `Timestamp,Action,Hand,Amount,Balance\n${csvContent}`;
        const blob = new Blob([finalCsvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'poker_trading_history.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        
        showMessage('Transaction history downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading transaction history:', error);
        showMessage('Error downloading transaction history: ' + error.message, 'error');
    }
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

let lastClickedButton = null;

document.addEventListener('click', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('btn')) {
        lastClickedButton = e.target;
    }
});

function showMessage(message, type) {
    if (type === 'success') {
        // Suppress success banners – do nothing
        return;
    }

    // For errors, visually highlight the button that triggered the action
    if (type === 'error' && lastClickedButton) {
        lastClickedButton.classList.add('btn-error-flash');
        setTimeout(() => {
            if (lastClickedButton) {
                lastClickedButton.classList.remove('btn-error-flash');
            }
        }, 1500);
    }
    // Also log to console for debugging purposes
    console.warn(message);
}

// Original Simulator Functions (keeping for the simulator section)
let playerCount = 2;

function isDuplicateCard(card, excludeInputs = []) {
    const used = getAllUsedCards(excludeInputs);
    return used.has(card);
}

function handleCardInput(input) {
    input.value = input.value.toUpperCase();
    validateCard(input);

    // Check for duplicate cards (across all inputs)
    const cardVal = input.value.toUpperCase();
    if (isValidCard(cardVal) && isDuplicateCard(cardVal, [input])) {
        input.classList.add('invalid');
        showMessage('Duplicate card', 'error');
    }

    updateCardDisplays();
}

function updateCardDisplays() {
    // Update player hand displays
    document.querySelectorAll('.player-hand').forEach(playerHand => {
        const inputs = playerHand.querySelectorAll('.card-input');
        const handCards = playerHand.querySelector('.hand-cards');
        handCards.innerHTML = '';
        
        inputs.forEach(input => {
            const card = input.value.toUpperCase();
            if (isValidCard(card)) {
                const img = document.createElement('img');
                img.src = `/static/img/cards/PNG/${card}.png`;
                img.alt = card;
                img.className = 'card-image';
                handCards.appendChild(img);
            }
        });
    });

    // Update community card displays
    const communityInputs = document.querySelectorAll('.community-card');
    const communityDisplay = document.createElement('div');
    communityDisplay.className = 'community-display';
    
    communityInputs.forEach(input => {
        const card = input.value.toUpperCase();
        if (isValidCard(card)) {
            const img = document.createElement('img');
            img.src = `/static/img/cards/PNG/${card}.png`;
            img.alt = card;
            img.className = 'card-image';
            communityDisplay.appendChild(img);
        }
    });

    // Replace or append the community display
    const communitySection = document.querySelector('.community-cards-section');
    const existingDisplay = communitySection.querySelector('.community-display');
    if (existingDisplay) {
        communitySection.replaceChild(communityDisplay, existingDisplay);
    } else {
        communitySection.appendChild(communityDisplay);
    }
}

function isValidCard(card) {
    if (!card || card.length !== 2) return false;
    const rank = card[0];
    const suit = card[1];
    const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const validSuits = ['H', 'D', 'C', 'S'];
    return validRanks.includes(rank) && validSuits.includes(suit);
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
    if (playerCount >= 4) {
        showMessage('Maximum 4 hands allowed', 'error');
        return;
    }
    
    playerCount++;
    const playerHand = document.createElement('div');
    playerHand.className = 'player-hand';
    playerHand.dataset.player = playerCount;
    
    playerHand.innerHTML = `
        <div class="player-header">
            <h3>Hand ${playerCount}</h3>
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
    
    // Check for scroll overflow after adding new player
    checkSimulatorScrollOverflow();
}

function removePlayer(button) {
    const playerHand = button.closest('.player-hand');
    const playerHands = document.getElementById('player-hands');
    
    if (playerHands.children.length <= 2) {
        showMessage('Minimum 2 hands required', 'error');
        return;
    }
    
    playerHand.remove();
    playerCount--;
    
    // Renumber remaining players
    document.querySelectorAll('.player-hand').forEach((hand, index) => {
        hand.setAttribute('data-player', index + 1);
        hand.querySelector('h3').textContent = `Hand ${index + 1}`;
    });
    
    // Check for scroll overflow after removing player
    checkSimulatorScrollOverflow();
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
    document.querySelectorAll('.community-card').forEach(input => {
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
        showMessage('Need at least 2 hands with valid cards', 'error');
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
    // Hide the separate results section
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'none';
    
    // Get all player hand elements
    const playerHands = document.querySelectorAll('.player-hand');
    
    // Add results to each player hand widget
    playerHands.forEach((playerHand, index) => {
        if (index < data.probabilities.length) {
            // Remove any existing results
            const existingResults = playerHand.querySelector('.hand-results');
            if (existingResults) {
                existingResults.remove();
            }
            
            // Create results element
            const resultsElement = document.createElement('div');
            resultsElement.className = 'hand-results';
            resultsElement.innerHTML = `
                <div class="hand-strength">
                    <span class="strength-label">Win Probability</span>
                    <div class="strength-bar">
                        <div class="strength-fill" style="width: ${data.probabilities[index]}%"></div>
                    </div>
                    <span class="probability-percentage">${data.probabilities[index]}%</span>
                </div>
            `;
            
            // Insert after hand-cards
            const handCards = playerHand.querySelector('.hand-cards');
            if (handCards) {
                handCards.parentNode.insertBefore(resultsElement, handCards.nextSibling);
            }
        }
    });
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
    document.querySelectorAll('.community-card').forEach(input => {
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
        showMessage('You must own a hand to see community cards!', 'error');
        return;
    }
    
    try {
        // Store the current state before dealing new card
        const oldSellPrice = gameState.currentHands[gameState.ownedHand].sell_price || 
                           gameState.currentHands[gameState.ownedHand].price || 0;
        const previousCardCount = gameState.communityCards.length;
        
        // Disable the button during animation
        const nextBtn = document.getElementById('next-card-btn');
        nextBtn.disabled = true;
        nextBtn.textContent = 'Dealing...';
        
        const response = await fetch('/api/next-community', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            // Re-enable button on error
            nextBtn.disabled = false;
            if (previousCardCount === 0) {
                nextBtn.textContent = 'Deal Flop';
            } else if (previousCardCount === 3) {
                nextBtn.textContent = 'Deal Turn';
            } else if (previousCardCount === 4) {
                nextBtn.textContent = 'Deal River';
            }
            return;
        }
        
        gameState.currentHands = data.hands;
        gameState.communityCards = data.community_cards;
        
        // Calculate profit change based on new sell price
        const newSellPrice = data.hands[gameState.ownedHand].sell_price || 
                           data.hands[gameState.ownedHand].price || 0;
        const priceChange = newSellPrice - oldSellPrice;
        
        // Update UI with animations for community cards and prices
        updateHandsDisplay(true); // Enable price animations
        updateCommunityCardsDisplay(true, previousCardCount);
        updateTransactionHistory();
        
        // Update other UI elements
        document.getElementById('current-balance').textContent = `$${gameState.balance}`;
        let ownedValue = 0;
        if (gameState.ownedHand !== null && gameState.currentHands[gameState.ownedHand]) {
            const ownedHandData = gameState.currentHands[gameState.ownedHand];
            ownedValue = ownedHandData.sell_price !== undefined ? ownedHandData.sell_price : (ownedHandData.price || 0);
        }
        const currentProfit = (gameState.balance + ownedValue) - gameState.sessionStartBalance;
        gameState.sessionProfit = currentProfit;
        const profitDisplay = document.getElementById('session-profit');
        const profitText = currentProfit >= 0 ? `+$${currentProfit}` : `-$${Math.abs(currentProfit)}`;
        profitDisplay.textContent = profitText;
        profitDisplay.className = `session-profit ${currentProfit >= 0 ? 'profit' : 'loss'}`;
        
        // Update button state after a delay to allow for animation
        setTimeout(() => {
            if (gameState.communityCards.length >= 5) {
                nextBtn.disabled = true;
                nextBtn.textContent = 'Board Complete';
            } else if (gameState.ownedHand === null) {
                nextBtn.disabled = true;
                nextBtn.textContent = 'Buy a Hand First';
            } else {
                nextBtn.disabled = false;
                if (gameState.communityCards.length === 3) {
                    nextBtn.textContent = 'Deal Turn';
                } else if (gameState.communityCards.length === 4) {
                    nextBtn.textContent = 'Deal River';
                }
            }
        }, 800); // Wait for animation to mostly complete
        
        // Show price change message after animation starts
        setTimeout(() => {
            if (priceChange > 0) {
                showMessage(`Hand value increased by $${priceChange}!`, 'success');
            } else if (priceChange < 0) {
                showMessage(`Hand value decreased by $${Math.abs(priceChange)}`, 'error');
            }
        }, 300);
        
        // Check if game is over and we have a winning hand
        if (gameState.communityCards.length === 5 && gameState.ownedHand !== null) {
            setTimeout(async () => {
                const ownedHand = gameState.currentHands[gameState.ownedHand];
                const maxProbability = Math.max(...gameState.currentHands.map(h => h.probability));
                const isWinning = ownedHand.probability === maxProbability;
                const winningHandsCount = gameState.currentHands.filter(h => h.probability === maxProbability).length;
                
                // Show final results message first
                if (isWinning) {
                    if (winningHandsCount > 1) {
                        showMessage('🤝 Game Over - Your hand was part of a draw!', 'success');
                    } else {
                        showMessage('🏆 Game Over - Your hand won!', 'success');
                    }
                } else {
                    showMessage('Game Over - Your hand did not win.', 'error');
                }
                
                // Automatically sell any hand when game is over
                await sellHand();
            }, 1000); // Wait for animation to complete
        }
        
    } catch (error) {
        showMessage('Error dealing community card: ' + error.message, 'error');
        // Re-enable button on error
        const nextBtn = document.getElementById('next-card-btn');
        nextBtn.disabled = false;
        if (gameState.communityCards.length === 0) {
            nextBtn.textContent = 'Deal Flop';
        } else if (gameState.communityCards.length === 3) {
            nextBtn.textContent = 'Deal Turn';
        } else if (gameState.communityCards.length === 4) {
            nextBtn.textContent = 'Deal River';
        }
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

function addPlayerToSimulator() {
    const playerHands = document.getElementById('player-hands');
    const playerCount = playerHands.children.length + 1;
    
    const newHand = document.createElement('div');
    newHand.className = 'player-hand';
    newHand.setAttribute('data-player', playerCount);
    
    newHand.innerHTML = `
        <div class="player-header">
            <h3>Hand ${playerCount}</h3>
            <button class="remove-player" onclick="removePlayer(this)">×</button>
        </div>
        <div class="card-inputs">
            <input type="text" class="card-input" placeholder="e.g., AH" maxlength="2" data-card="1">
            <input type="text" class="card-input" placeholder="e.g., KS" maxlength="2" data-card="2">
        </div>
        <div class="hand-cards"></div>
    `;
    
    playerHands.appendChild(newHand);
    
    // Add event listeners to new inputs
    newHand.querySelectorAll('.card-input').forEach(input => {
        input.addEventListener('input', function() {
            updateCardDisplays();
        });
    });
}