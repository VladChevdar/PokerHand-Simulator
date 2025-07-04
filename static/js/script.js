// Trading Game State
let gameState = {
    balance: 500,
    ownedHand: null,
    currentHands: [],
    communityCards: [],
    gameHistory: [],
    fullGameHistory: [],
    sessionProfit: 0,               // Track profit for current trading session (computed dynamically)
    sessionStartBalance: 0,         // Balance after last "Generate Hands" action
    previousPrices: [],             // Track previous prices for animation
    leverage: 1,                    // Current leverage multiplier (1x to 10x)
    messageLog: []                  // Store all messages for download
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

    // Setup leverage slider
    const leverageSlider = document.getElementById('leverage-slider');
    const leverageLabel = document.getElementById('leverage-value');
    if (leverageSlider && leverageLabel) {
        leverageSlider.max = 20; // Set max to 20x
        leverageSlider.addEventListener('input', function() {
            const leverage = parseInt(this.value);
            leverageLabel.textContent = `${leverage}x`;
            
            // Update leverage if no hand is owned
            if (gameState.ownedHand === null) {
                setLeverage(leverage);
            }
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

    // Render initial card placeholders
    updateCardDisplays();

    // Toggle How to Play (help) section
    const helpSection = document.getElementById('help-section');
    const toggleHelp = document.getElementById('toggle-help');
    const hideHelp = document.getElementById('hide-help');
    if (toggleHelp && helpSection) {
        toggleHelp.addEventListener('click', function() {
            helpSection.style.display = 'block';
            toggleHelp.style.display = 'none';
        });
    }
    if (hideHelp && helpSection && toggleHelp) {
        hideHelp.addEventListener('click', function() {
            helpSection.style.display = 'none';
            toggleHelp.style.display = 'block';
        });
    }

    // Toggle Simulation Tips section
    const simTipsSection = document.getElementById('sim-tips-section');
    const toggleSimTips = document.getElementById('toggle-sim-tips');
    const hideSimTips = document.getElementById('hide-sim-tips');
    if (toggleSimTips && simTipsSection) {
        toggleSimTips.addEventListener('click', function() {
            simTipsSection.style.display = 'block';
            toggleSimTips.style.display = 'none';
        });
    }
    if (hideSimTips && simTipsSection && toggleSimTips) {
        hideSimTips.addEventListener('click', function() {
            simTipsSection.style.display = 'none';
            toggleSimTips.style.display = 'block';
        });
    }
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
    
    // Transaction history toggle
    const toggleHistory = document.getElementById('toggle-history');
    const transactionHistory = document.getElementById('transaction-history');
    if (toggleHistory && transactionHistory) {
        toggleHistory.addEventListener('click', function() {
            transactionHistory.classList.toggle('hidden');
        });
    }
    
    // Message log download
    const downloadMessageLogBtn = document.getElementById('download-message-log');
    if (downloadMessageLogBtn) {
        downloadMessageLogBtn.addEventListener('click', downloadMessageLog);
    }
    
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
        // Remove all but the first two player-hand widgets
        const playerHands = document.querySelectorAll('.player-hand');
        for (let i = playerHands.length - 1; i >= 2; i--) {
            playerHands[i].remove();
        }
        // Clear inputs and results for the remaining two
        document.querySelectorAll('.player-hand').forEach(playerHand => {
            const inputs = playerHand.querySelectorAll('.card-input');
            inputs.forEach(input => { input.value = ''; });
            const handCards = playerHand.querySelector('.hand-cards');
            if (handCards) handCards.innerHTML = '';
            const handResults = playerHand.querySelector('.hand-results');
            if (handResults) handResults.remove();
        });
        
        // Reset playerCount to match number of player-hand widgets
        playerCount = document.querySelectorAll('.player-hand').length;
        
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

        // Re-render placeholders
        updateCardDisplays();

        // Re-enable add-player button and remove error style
        const addBtn = document.getElementById('add-player');
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.classList.remove('btn-error-flash');
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
        gameState.gameHistory = data.game_history;  // This is display history (last 20)
        gameState.fullGameHistory = data.full_game_history;  // Full history for downloads
        gameState.leverage = data.leverage || 1;
        if (!gameState.sessionStartBalance) {
            gameState.sessionStartBalance = data.balance;
        }
        
        // Update leverage slider to match game state
        const leverageSlider = document.getElementById('leverage-slider');
        const leverageLabel = document.getElementById('leverage-value');
        if (leverageSlider && leverageLabel) {
            leverageSlider.value = gameState.leverage;
            leverageLabel.textContent = `${gameState.leverage}x`;
        }
        
        updateUI();
    } catch (error) {
        console.error('Error loading game state:', error);
        showMessage('Error loading game state: ' + error.message, 'error');
    }
}

async function setLeverage(leverage) {
    try {
        const response = await fetch('/api/set-leverage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ leverage: leverage })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showMessage(data.error, 'error');
            // Reset slider to current leverage on error
            const leverageSlider = document.getElementById('leverage-slider');
            const leverageLabel = document.getElementById('leverage-value');
            if (leverageSlider && leverageLabel) {
                leverageSlider.value = gameState.leverage;
                leverageLabel.textContent = `${gameState.leverage}x`;
            }
            return;
        }
        
        gameState.leverage = data.leverage;
        updateUI();
    } catch (error) {
        showMessage('Error setting leverage: ' + error.message, 'error');
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
        
        // Baseline should be balance BEFORE the $10 generate fee so profit starts at -$10
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
        const leverageText = data.leverage > 1 ? ` with ${data.leverage}x leverage` : '';
        if (data.refund_amount && data.refund_amount > 0) {
            showMessage(`Refunded $${data.refund_amount} for previous hand and bought Hand ${playerIndex + 1} for $${price}${leverageText}!`, 'success');
        } else {
            showMessage(`Successfully bought Hand ${playerIndex + 1} for $${price}${leverageText}!`, 'success');
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
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
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
        
        // Show leveraged profit/loss information
        const leverageText = data.leverage > 1 ? ` (${data.leverage}x leverage)` : '';
        const actualPayout = data.transaction?.actual_payout || currentPrice;
        const leveragedProfitLoss = data.transaction?.leveraged_profit_loss;
        
        if (actualPayout > 0) {
            if (leveragedProfitLoss !== null && leveragedProfitLoss !== undefined) {
                const profitLossText = leveragedProfitLoss >= 0 ? `+$${leveragedProfitLoss}` : `-$${Math.abs(leveragedProfitLoss)}`;
                showMessage(`Hand sold for $${actualPayout}! Net: ${profitLossText}${leverageText}`, 'success');
            } else {
                showMessage(`Successfully sold hand for $${actualPayout}!${leverageText}`, 'success');
            }
        } else {
            showMessage(`Hand sold for $0 - better luck next time!${leverageText}`, 'success');
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
        gameState.leverage = data.leverage || 1; // Reset leverage
        gameState.messageLog = []; // Clear message log
        
        // Clear UI
        document.getElementById('hands-container').innerHTML = '<p class="no-hands">Click "Generate New Hands" to start trading!</p>';
        document.getElementById('community-cards-display').innerHTML = '<p class="no-community">No board cards yet</p>';
        document.getElementById('transaction-history').innerHTML = '<p class="no-history">No transactions yet</p>';
        
        // Reset leverage slider
        const leverageSlider = document.getElementById('leverage-slider');
        const leverageLabel = document.getElementById('leverage-value');
        if (leverageSlider && leverageLabel) {
            leverageSlider.value = gameState.leverage;
            leverageLabel.textContent = `${gameState.leverage}x`;
        }
        
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
    
    // Calculate session profit based on actual cash transactions only
    // Include value of owned hand so profit remains unchanged after purchase but reflects price changes
    let ownedValue = 0;
    if (gameState.ownedHand !== null && gameState.currentHands[gameState.ownedHand]) {
        const ownedHandData = gameState.currentHands[gameState.ownedHand];
        const baseValue = ownedHandData.sell_price !== undefined ? ownedHandData.sell_price : (ownedHandData.price || 0);
        ownedValue = baseValue * (gameState.leverage || 1);
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
    
    // Enable/disable leverage slider based on hand ownership
    const leverageSlider = document.getElementById('leverage-slider');
    if (leverageSlider) {
        leverageSlider.disabled = gameState.ownedHand !== null;
        if (gameState.ownedHand !== null) {
            leverageSlider.title = 'Cannot change leverage while owning a hand';
        } else {
            leverageSlider.title = 'Set leverage multiplier (1x to 20x)';
        }
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
        
        // Calculate leveraged amounts for display
        const leverage = gameState.leverage || 1;
        const baseBuyPrice = hand.price;
        const displayBuyPrice = baseBuyPrice * leverage; // Leveraged cost for buying
        const leveragedSellPrice = hand.sell_price || hand.price;
        
        // Show leverage info if > 1x
        const leverageDisplay = leverage > 1 ? ` (${leverage}x)` : '';
        
        handElement.innerHTML = `
            <div class="hand-header">
                <span class="hand-title">Hand ${index + 1}</span>
                <span class="hand-price ${priceChangeClass}">$${displayBuyPrice}</span>
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
                        ${gameState.communityCards.length === 5 ? 'Game Complete' : 'Sell'}
                    </button>` :
                    `<button class="btn btn-primary" onclick="buyHand(${index}, ${baseBuyPrice})" ${gameState.ownedHand !== null || gameState.communityCards.length === 5 ? 'disabled' : ''}>
                        ${gameState.communityCards.length === 5 ? 'Game Complete' : 'Buy'}
                    </button>`
                }
            </div>
            ${hand.hand_type ? `
                <div class="hand-type-display">
                    <span class="hand-type">${hand.hand_type.name || hand.hand_type}</span>
                </div>
            ` : ''}
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

    // Ensure display container exists
    if (!display) return;

    // Total number of community card slots in Texas Hold'em
    const TOTAL_SLOTS = 5;

    // Fallback in case state properties are missing
    const communityCards = (gameState.communityCards || []).slice();

    // Clear the current board
    display.innerHTML = '';

    for (let i = 0; i < TOTAL_SLOTS; i++) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.setAttribute('data-slot', i);

        if (i < communityCards.length) {
            // This slot already has a dealt card
            const card = communityCards[i];
            const frontImage = getCardImagePath(card);

            if (animateNewCards && i >= previousCardCount) {
                // Animate flip for newly dealt cards
                cardElement.classList.add('deal-animation');
                cardElement.style.backgroundImage = `url('/static/img/cards/PNG/blue_back.png')`;

                // Flip to front image part-way through animation
                setTimeout(() => {
                    cardElement.style.backgroundImage = `url('${frontImage}')`;
                }, 240);

                // Clean up animation classes afterwards
                setTimeout(() => {
                    cardElement.classList.remove('deal-animation', 'flop-1', 'flop-2', 'flop-3', 'turn', 'river');
                }, 400);

                // Extra class for correct stagger (uses existing CSS delays)
                if (previousCardCount === 0) {
                    // Flop
                    cardElement.classList.add(`flop-${i + 1}`);
                } else if (previousCardCount === 3) {
                    cardElement.classList.add('turn');
                } else if (previousCardCount === 4) {
                    cardElement.classList.add('river');
                }
            } else {
                // Already dealt previously – just show front
                cardElement.style.backgroundImage = `url('${frontImage}')`;
            }

            cardElement.setAttribute('data-card', card);
        } else {
            // Undealt slot – show card back
            cardElement.style.backgroundImage = `url('/static/img/cards/PNG/blue_back.png')`;
            cardElement.classList.add('undealt');
        }

        display.appendChild(cardElement);
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

        const getActionText = (action, player, leverage) => {
            const leverageText = leverage && leverage > 1 ? ` (${leverage}x)` : '';
            switch(action) {
                case 'buy': return `BUY Hand ${player}${leverageText}`;
                case 'sell': return `SELL Hand ${player}${leverageText}`;
                case 'refund': return `REFUND Hand ${player}${leverageText}`;
                case 'generate': return `GENERATE ${player} Hands`;
                default: return action;
            }
        };

        const timestamp = transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : '';

        return `
            <div class="transaction-item">
                <div class="transaction-left">
                    <div class="transaction-action ${transaction.action.toLowerCase()}">
                        ${getActionIcon(transaction.action)} ${getActionText(transaction.action, transaction.player, transaction.leverage)}
                    </div>
                    <div class="transaction-time" style="font-size: 0.8em; color: #666;">
                        ${timestamp}
                    </div>
                </div>
                <div class="transaction-amount ${transaction.action.toLowerCase() === 'sell' || transaction.action.toLowerCase() === 'refund' ? 'positive' : 'negative'}">
                    ${(() => {
                        if (transaction.action.toLowerCase() === 'sell' && transaction.actual_payout !== undefined) {
                            return `+$${transaction.actual_payout}`;
                        } else if (transaction.action.toLowerCase() === 'sell' || transaction.action.toLowerCase() === 'refund') {
                            return `+$${transaction.price}`;
                        } else {
                            return `-$${transaction.price}`;
                        }
                    })()}
                </div>
            </div>
        `;
    }).join('');
}

async function downloadTransactionHistory(testMode = false) {
    if (!gameState.gameHistory || gameState.gameHistory.length === 0) {
        showMessage('No transactions to download. Generate hands and make some trades first!', 'error');
        return;
    }

    try {
        // Get full history from server
        const response = await fetch('/api/download-history');
        const data = await response.json();
        const fullHistory = data.game_history;

        if (!fullHistory || fullHistory.length === 0) {
            showMessage('No transactions available to download', 'error');
            return;
        }

        const csvContent = fullHistory.map((transaction, index) => {
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
    // Log all messages with timestamp for later download
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        message: message,
        context: {
            balance: gameState.balance,
            ownedHand: gameState.ownedHand,
            communityCardsCount: gameState.communityCards ? gameState.communityCards.length : 0,
            handsCount: gameState.currentHands ? gameState.currentHands.length : 0
        }
    };
    gameState.messageLog.push(logEntry);

    // For errors, visually highlight the button that triggered the action, but not Deal Flop
    if (type === 'error' && lastClickedButton) {
        if (!lastClickedButton.id || lastClickedButton.id !== 'next-card-btn') {
            lastClickedButton.classList.add('btn-error-flash');
            setTimeout(() => {
                if (lastClickedButton) {
                    lastClickedButton.classList.remove('btn-error-flash');
                }
            }, 1500);
        }
    }

    // Log to console for immediate debugging
    if (type === 'error') {
        console.error(`[${type.toUpperCase()}] ${message}`);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

async function downloadMessageLog() {
    if (!gameState.messageLog || gameState.messageLog.length === 0) {
        showMessage('No messages to download. Play the game first!', 'error');
        return;
    }

    try {
        // Create CSV content with headers
        const csvContent = gameState.messageLog.map((entry, index) => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            const type = entry.type.toUpperCase();
            const message = entry.message.replace(/"/g, '""'); // Escape quotes
            const balance = entry.context.balance || 'N/A';
            const ownedHand = entry.context.ownedHand !== null ? entry.context.ownedHand + 1 : 'None';
            const communityCards = entry.context.communityCardsCount || 0;
            const handsCount = entry.context.handsCount || 0;
            return `"${timestamp}","${type}","${message}","${balance}","${ownedHand}","${communityCards}","${handsCount}"`;
        }).join('\n');

        const finalCsvContent = `Timestamp,Type,Message,Balance,Owned Hand,Community Cards,Total Hands\n${csvContent}`;
        const blob = new Blob([finalCsvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'poker_game_messages.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        
        showMessage('Message log downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading message log:', error);
        showMessage('Error downloading message log: ' + error.message, 'error');
    }
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
    // -------- Player hand displays --------
    // Gather all entered cards to check for duplicates
    const allInputs = Array.from(document.querySelectorAll('.card-input, .community-card'));
    const cardCounts = {};
    allInputs.forEach(input => {
        const card = input.value.toUpperCase();
        if (isValidCard(card)) {
            cardCounts[card] = (cardCounts[card] || 0) + 1;
        }
    });

    document.querySelectorAll('.player-hand').forEach(playerHand => {
        const inputs = playerHand.querySelectorAll('.card-input');
        const handCards = playerHand.querySelector('.hand-cards');
        handCards.innerHTML = '';

        let validCount = 0;
        inputs.forEach(input => {
            const card = input.value.toUpperCase();
            if (isValidCard(card) && cardCounts[card] === 1) {
                const img = document.createElement('img');
                img.src = `/static/img/cards/PNG/${card}.png`;
                img.alt = card;
                img.className = 'card-image';
                handCards.appendChild(img);
                validCount++;
            } else if (isValidCard(card) && cardCounts[card] > 1) {
                // Duplicate: show red placeholder
                const img = document.createElement('img');
                img.src = '/static/img/cards/PNG/blue_back.png';
                img.alt = 'Duplicate card';
                img.className = 'card-image undealt';
                img.style.filter = 'grayscale(40%) brightness(0.7) sepia(1) hue-rotate(-50deg) saturate(6)';
                handCards.appendChild(img);
                validCount++;
            }
        });

        // Add card back placeholders for remaining slots (up to 2)
        for (let i = validCount; i < 2; i++) {
            const img = document.createElement('img');
            img.src = '/static/img/cards/PNG/blue_back.png';
            img.alt = 'Card back';
            img.className = 'card-image undealt';
            handCards.appendChild(img);
        }
    });

    // -------- Community card displays --------
    const communityInputs = document.querySelectorAll('.community-card');
    const communityDisplay = document.createElement('div');
    communityDisplay.className = 'community-display';

    let communityValid = 0;
    communityInputs.forEach(input => {
        const card = input.value.toUpperCase();
        if (isValidCard(card) && cardCounts[card] === 1) {
            const img = document.createElement('img');
            img.src = `/static/img/cards/PNG/${card}.png`;
            img.alt = card;
            img.className = 'card-image';
            communityDisplay.appendChild(img);
            communityValid++;
        }
    });

    // Add placeholders to reach 5 community cards
    for (let i = communityValid; i < 5; i++) {
        const img = document.createElement('img');
        img.src = '/static/img/cards/PNG/blue_back.png';
        img.alt = 'Card back';
        img.className = 'card-image undealt';
        communityDisplay.appendChild(img);
    }

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
    if (playerCount >= 10) {
        showMessage('Maximum 10 hands allowed', 'error');
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

    // Render placeholders for new player
    updateCardDisplays();
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

    // Refresh placeholders
    updateCardDisplays();
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
    
    if (!gameState.currentHands || gameState.currentHands.length === 0) {
        showMessage('No hands available. Please generate hands first.', 'error');
        return;
    }
    
    try {
        // Guard against missing hand data (can happen if server session was reset)
        let oldSellPrice = 0;
        const ownedHandData = gameState.currentHands && gameState.currentHands[gameState.ownedHand];
        if (ownedHandData) {
            oldSellPrice = ownedHandData.sell_price !== undefined ? ownedHandData.sell_price : (ownedHandData.price || 0);
        }
        const previousCardCount = gameState.communityCards.length;
        
        // Disable the button during animation
        const nextBtn = document.getElementById('next-card-btn');
        nextBtn.disabled = true;
        nextBtn.textContent = 'Dealing...';
        
        const response = await fetch('/api/next-community', {
            method: 'POST',
            credentials: 'same-origin' // ensure cookies (session) are always sent
        });

        // If the server responds with an error status, attempt to parse JSON for a cleaner error message
        if (!response.ok) {
            let errMsg = `Server error: ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson && errJson.error) errMsg = errJson.error;
            } catch (_) {
                // Fallback to text if JSON parsing fails
                errMsg = await response.text();
            }
            throw new Error(errMsg);
        }

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
        
        // Update all UI elements
        updateUI();
        
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