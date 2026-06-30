// ===== SNAKE GAME - IPC x MAKITA =====

// --- CONFIGURATION ---
const CONFIG = {
    maxGridCols: 14,     // max cells horizontally
    maxGridRows: 14,     // max cells vertically
    minCellSize: 32,     // minimum pixel size per cell (keeps images visible)
    preferredCellSize: 38, // ideal cell size for clear images
    startSpeed: 280,     // very slow start (ms per tick)
    maxSpeed: 70,        // fastest possible (ms per tick)
    speedCurve: 0.08,    // how quickly speed ramps up (higher = faster ramp)
    initialLength: 3,
};

// Calculate speed from score: starts at startSpeed, asymptotically approaches maxSpeed
function getSpeedForScore(s) {
    const range = CONFIG.startSpeed - CONFIG.maxSpeed;
    return Math.round(CONFIG.maxSpeed + range * Math.exp(-CONFIG.speedCurve * s));
}

// --- GAME STATE ---
let canvas, ctx;
let cellSize;
let gridCols, gridRows;
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let foodIndex = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('ipc_snake_highscore')) || 0;
let gameLoop = null;
let gameSpeed;
let isPaused = false;
let isRunning = false;
let collectedTools = [];

// --- IMAGE LOADING ---
const toolImages = [];
const toolSources = [
    'images/tool1.jpg',
    'images/tool2.jpg',
    'images/tool3.jpg',
    'images/tool4.jpg'
];
const toolNames = ['Impact Wrench', 'Chainsaw', 'Lawn Mower', 'String Trimmer'];
let ipcLogo = new Image();
ipcLogo.src = 'images/ipc-logo.jpg';

let imagesLoaded = 0;
const totalImages = toolSources.length + 1; // tools + logo

function loadImages() {
    return new Promise((resolve) => {
        let loaded = 0;
        const checkDone = () => {
            loaded++;
            if (loaded >= totalImages) resolve();
        };

        ipcLogo = new Image();
        ipcLogo.crossOrigin = 'anonymous';
        ipcLogo.onload = checkDone;
        ipcLogo.onerror = checkDone;
        ipcLogo.src = 'images/ipc-logo.jpg';

        toolSources.forEach((src, i) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = checkDone;
            img.onerror = checkDone;
            img.src = src;
            toolImages[i] = img;
        });
    });
}

// --- SCREEN MANAGEMENT ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// --- CANVAS SETUP ---
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    const container = document.getElementById('canvas-container');
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    // Start with preferred cell size, but adapt to fit the container
    cellSize = CONFIG.preferredCellSize;

    // Calculate how many cells fit at the preferred size
    let cols = Math.floor(containerW / cellSize);
    let rows = Math.floor(containerH / cellSize);

    // Cap to max grid dimensions for a compact, clear board
    cols = Math.min(cols, CONFIG.maxGridCols);
    rows = Math.min(rows, CONFIG.maxGridRows);

    // Ensure at least 8 cells each way so the game is playable
    cols = Math.max(cols, 8);
    rows = Math.max(rows, 8);

    // If the container is too small for preferred size, shrink cells but never below min
    const fitCellW = Math.floor(containerW / cols);
    const fitCellH = Math.floor(containerH / rows);
    cellSize = Math.max(CONFIG.minCellSize, Math.min(fitCellW, fitCellH, CONFIG.preferredCellSize));

    // Recalculate cols/rows with final cell size (may gain/lose a cell)
    cols = Math.min(Math.floor(containerW / cellSize), CONFIG.maxGridCols);
    rows = Math.min(Math.floor(containerH / cellSize), CONFIG.maxGridRows);
    cols = Math.max(cols, 8);
    rows = Math.max(rows, 8);

    gridCols = cols;
    gridRows = rows;

    canvas.width = gridCols * cellSize;
    canvas.height = gridRows * cellSize;

    // Center canvas in container
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
}

// --- GAME INITIALIZATION ---
async function startGame() {
    await loadImages();
    
    showScreen('game-screen');
    
    // Small delay to let layout settle
    setTimeout(() => {
        setupCanvas();
        initGame();
    }, 50);
}

function initGame() {
    // Reset state
    score = 0;
    gameSpeed = getSpeedForScore(0);
    isPaused = false;
    isRunning = true;
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    foodIndex = 0;
    collectedTools = [];
    
    updateScoreDisplay();

    // Initialize snake in center
    const startX = Math.floor(gridCols / 2);
    const startY = Math.floor(gridRows / 2);
    snake = [];
    for (let i = CONFIG.initialLength - 1; i >= 0; i--) {
        snake.push({ x: startX - i, y: startY });
    }

    // Place first food
    placeFood();

    // Start game loop
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(gameTick, gameSpeed);
}

// --- FOOD PLACEMENT ---
function placeFood() {
    let pos;
    do {
        pos = {
            x: Math.floor(Math.random() * gridCols),
            y: Math.floor(Math.random() * gridRows)
        };
    } while (isSnakeAt(pos.x, pos.y));
    
    food = { ...pos, toolIndex: foodIndex % toolImages.length };
    foodIndex++;
}

function isSnakeAt(x, y) {
    return snake.some(seg => seg.x === x && seg.y === y);
}

// --- GAME TICK ---
function gameTick() {
    if (isPaused || !isRunning) return;

    // Apply queued direction
    direction = { ...nextDirection };

    // Calculate new head position
    const head = snake[snake.length - 1];
    const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
    };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= gridCols || newHead.y < 0 || newHead.y >= gridRows) {
        gameOver();
        return;
    }

    // Self collision
    if (isSnakeAt(newHead.x, newHead.y)) {
        gameOver();
        return;
    }

    snake.push(newHead);

    // Food collision
    if (food && newHead.x === food.x && newHead.y === food.y) {
        score++;
        collectedTools.push(food.toolIndex);
        updateScoreDisplay();
        
        // Recalculate speed from score (smooth curve: slow → fast)
        gameSpeed = getSpeedForScore(score);
        clearInterval(gameLoop);
        gameLoop = setInterval(gameTick, gameSpeed);

        placeFood();
    } else {
        snake.shift(); // remove tail
    }

    draw();
}

// --- DRAWING ---
function draw() {
    // Clear canvas
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (subtle)
    drawGrid();

    // Draw food
    drawFood();

    // Draw snake
    drawSnake();
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= gridCols; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= gridRows; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(canvas.width, y * cellSize);
        ctx.stroke();
    }
}

function drawSnake() {
    const len = snake.length;
    
    for (let i = 0; i < len; i++) {
        const seg = snake[i];
        const x = seg.x * cellSize;
        const y = seg.y * cellSize;
        const isHead = (i === len - 1);
        const isTail = (i === 0);
        
        // Body gradient: brighter towards head
        const t = i / (len - 1 || 1);
        const r = Math.floor(0 + t * 0);
        const g = Math.floor(90 + t * 80);
        const b = Math.floor(100 + t * 50);
        const alpha = 0.7 + t * 0.3;
        
        // Draw body segment with rounded corners
        const padding = 1;
        const segSize = cellSize - padding * 2;
        const radius = Math.min(4, segSize / 3);
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        
        // Rounded rect
        drawRoundRect(x + padding, y + padding, segSize, segSize, radius);
        ctx.fill();
        
        // Subtle border
        ctx.strokeStyle = `rgba(79, 179, 191, ${0.2 + t * 0.4})`;
        ctx.lineWidth = 1;
        drawRoundRect(x + padding, y + padding, segSize, segSize, radius);
        ctx.stroke();

        if (isHead) {
            // Draw IPC logo on top of the head
            drawHeadLogo(x, y);
        }
    }
}

function drawHeadLogo(x, y) {
    const pad = 1;
    const size = cellSize - pad * 2;
    const r = Math.min(6, size / 4);

    ctx.save();

    // White rounded background so logo is always visible
    ctx.fillStyle = '#ffffff';
    drawRoundRect(x + pad, y + pad, size, size, r);
    ctx.fill();

    // Thin teal border
    ctx.strokeStyle = 'rgba(0, 131, 143, 0.6)';
    ctx.lineWidth = 1.5;
    drawRoundRect(x + pad, y + pad, size, size, r);
    ctx.stroke();

    if (ipcLogo.complete && ipcLogo.naturalWidth > 0) {
        // Clip to rounded rect and draw logo
        drawRoundRect(x + pad, y + pad, size, size, r);
        ctx.clip();
        ctx.drawImage(ipcLogo, x + pad, y + pad, size, size);
    } else {
        // Fallback text
        ctx.fillStyle = '#e63946';
        ctx.font = `bold ${Math.max(10, cellSize * 0.45)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('IPC', x + cellSize / 2, y + cellSize / 2);
    }

    ctx.restore();
}

function drawFood() {
    if (!food) return;

    const x = food.x * cellSize;
    const y = food.y * cellSize;
    const img = toolImages[food.toolIndex];

    // Pulsing glow animation
    const time = Date.now() / 500;
    const pulse = 1 + Math.sin(time) * 0.08;
    const glowSize = 4 + Math.sin(time) * 3;

    const pad = 1;
    const size = cellSize - pad * 2;
    const r = Math.min(8, size / 3);
    const centerX = x + cellSize / 2;
    const centerY = y + cellSize / 2;

    ctx.save();

    // Scale around center for pulse effect
    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);
    ctx.translate(-centerX, -centerY);

    // Glow shadow
    ctx.shadowColor = 'rgba(0, 200, 220, 0.5)';
    ctx.shadowBlur = glowSize * 3;

    // White rounded-rect background
    ctx.fillStyle = '#ffffff';
    drawRoundRect(x + pad, y + pad, size, size, r);
    ctx.fill();

    // Teal border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 131, 143, 0.5)';
    ctx.lineWidth = 1.5;
    drawRoundRect(x + pad, y + pad, size, size, r);
    ctx.stroke();

    if (img && img.complete && img.naturalWidth > 0) {
        // Draw tool image filling the cell with minimal padding
        const imgPad = 2;
        const imgSize = size - imgPad * 2;
        ctx.drawImage(img, x + pad + imgPad, y + pad + imgPad, imgSize, imgSize);
    } else {
        // Fallback emoji
        ctx.fillStyle = '#00838f';
        ctx.font = `bold ${cellSize * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔧', centerX, centerY);
    }

    ctx.restore();
}

function drawRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// --- SCORE ---
function updateScoreDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('high-score').textContent = highScore;
}

// --- GAME OVER ---
function gameOver() {
    isRunning = false;
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }

    const isNewHigh = score > highScore;
    if (isNewHigh) {
        highScore = score;
        localStorage.setItem('ipc_snake_highscore', highScore);
    }

    // Flash effect on canvas
    ctx.fillStyle = 'rgba(230, 57, 70, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setTimeout(() => {
        showGameOverScreen(isNewHigh);
    }, 500);
}

function showGameOverScreen(isNewHigh) {
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-high-score').textContent = highScore;
    
    const newHighEl = document.getElementById('new-high-score');
    if (isNewHigh && score > 0) {
        newHighEl.classList.remove('hidden');
    } else {
        newHighEl.classList.add('hidden');
    }

    // Show collected tools
    const grid = document.getElementById('collected-tools');
    grid.innerHTML = '';
    const toolsToShow = collectedTools.slice(-12); // show last 12
    toolsToShow.forEach(idx => {
        const img = document.createElement('img');
        img.src = toolSources[idx];
        img.alt = toolNames[idx];
        img.title = toolNames[idx];
        grid.appendChild(img);
    });

    showScreen('gameover-screen');
}

// --- PAUSE ---
function togglePause() {
    if (!isRunning) return;
    isPaused = !isPaused;
    document.getElementById('pause-overlay').classList.toggle('hidden', !isPaused);
}

function resumeGame() {
    isPaused = false;
    document.getElementById('pause-overlay').classList.add('hidden');
}

// --- INPUT: KEYBOARD ---
document.addEventListener('keydown', (e) => {
    if (!isRunning) return;

    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            e.preventDefault();
            if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            e.preventDefault();
            if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            e.preventDefault();
            if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            e.preventDefault();
            if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
            break;
        case ' ':
        case 'Escape':
        case 'p':
        case 'P':
            e.preventDefault();
            togglePause();
            break;
    }
});

// --- INPUT: TOUCH SWIPE ---
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

document.getElementById('game-canvas')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
}, { passive: false });

document.getElementById('game-canvas')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!isRunning || isPaused) return;
    
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;
    
    // Only process swipes (not taps) that are fast enough
    const minSwipe = 20;
    if (elapsed > 500) return;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (Math.abs(dx) > minSwipe) {
            if (dx > 0 && direction.x !== -1) nextDirection = { x: 1, y: 0 };
            else if (dx < 0 && direction.x !== 1) nextDirection = { x: -1, y: 0 };
        }
    } else {
        // Vertical swipe
        if (Math.abs(dy) > minSwipe) {
            if (dy > 0 && direction.y !== -1) nextDirection = { x: 0, y: 1 };
            else if (dy < 0 && direction.y !== 1) nextDirection = { x: 0, y: -1 };
        }
    }
}, { passive: false });

// --- INPUT: D-PAD (MOBILE) ---
function handleDpad(dir, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (!isRunning) return;
    
    switch (dir) {
        case 'up':
            if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
            break;
        case 'down':
            if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
            break;
        case 'left':
            if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
            break;
        case 'right':
            if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
            break;
        case 'pause':
            togglePause();
            break;
    }
}

// --- WINDOW RESIZE ---
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (isRunning) {
            setupCanvas();
            draw();
        }
    }, 200);
});

// --- INITIALIZE TOUCH LISTENERS ON LOAD ---
window.addEventListener('DOMContentLoaded', () => {
    // Set initial high score display
    document.getElementById('high-score').textContent = highScore;
    
    // Attach touch listeners to canvas (needs to be after DOM ready)
    const gameCanvas = document.getElementById('game-canvas');
    
    gameCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
    }, { passive: false });
    
    gameCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (!isRunning || isPaused) return;
        
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const elapsed = Date.now() - touchStartTime;
        
        const minSwipe = 20;
        if (elapsed > 500) return;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > minSwipe) {
                if (dx > 0 && direction.x !== -1) nextDirection = { x: 1, y: 0 };
                else if (dx < 0 && direction.x !== 1) nextDirection = { x: -1, y: 0 };
            }
        } else {
            if (Math.abs(dy) > minSwipe) {
                if (dy > 0 && direction.y !== -1) nextDirection = { x: 0, y: 1 };
                else if (dy < 0 && direction.y !== 1) nextDirection = { x: 0, y: -1 };
            }
        }
    }, { passive: false });

    // Prevent default touch behaviors on game area
    document.body.addEventListener('touchmove', (e) => {
        if (isRunning) e.preventDefault();
    }, { passive: false });
});

// --- PREVENT CONTEXT MENU ON LONG PRESS ---
document.addEventListener('contextmenu', (e) => {
    if (isRunning) e.preventDefault();
});
