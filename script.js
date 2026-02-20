/**
 * Gen Gems - Based on Forsaken's Generator Puzzles
 * A connection puzzle game where you link matching colored dots.
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameArea = document.getElementById('game-area');
const levelDisplay = document.getElementById('level-display');
const overlay = document.getElementById('ui-overlay');
const overlayMessage = document.getElementById('overlay-message');
const resetBtn = document.getElementById('reset-btn');
const winAudio = new Audio('WORKERSWORKING.m4a');
winAudio.preload = 'auto';
let audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // Play silently to unlock browser audio policy
    winAudio.volume = 0;
    winAudio.play().then(() => {
        winAudio.pause();
        winAudio.currentTime = 0;
        winAudio.volume = 1;
        console.log('Audio unlocked successfully');
    }).catch(e => console.log('Audio unlock failed:', e));
}

// Game State
let currentLevel = 0;
let grid = []; // The static level layout (endpoints)
let gridSize = 5;
let cellSize = 0;
let paths = {}; // { colorId: [{r, c}, {r, c}...] }
let isDragging = false;
let currentPathColor = null;

// Configuration
const COLORS = {
    1: '#FF3333', // Bright Red
    2: '#33FF33', // Bright Green
    3: '#3366FF', // Bright Blue
    4: '#FFFF33', // Bright Yellow
    5: '#FF33FF', // Bright Magenta
    6: '#33FFFF'  // Bright Cyan
};

const LEVELS = [
    {
        // Level 1 - 4 colors
        // Solutions:
        //   Color 1: (0,0)→(0,1)→(0,2)→(1,2)→(2,2)
        //   Color 2: (0,4)→(0,3)→(1,3)→(1,4)→(2,4)→(3,4)
        //   Color 3: (2,0)→(1,0)→(1,1)→(2,1)→(3,1)→(3,0)
        //   Color 4: (2,3)→(3,3)→(3,2)→(4,2)→(4,1)→(4,0)
        size: 5,
        grid: [
            [1, 0, 0, 0, 2],
            [0, 0, 0, 0, 0],
            [3, 0, 1, 4, 0],
            [3, 0, 0, 0, 2],
            [4, 0, 0, 0, 0]
        ]
    },
    {
        // Level 2 - 5 colors
        // Solutions:
        //   Color 1: (0,0)→(0,1)→(0,2)→(0,3)→(1,3)
        //   Color 2: (0,4)→(1,4)→(2,4)→(2,3)→(2,2)
        //   Color 3: (1,0)→(2,0)→(3,0)→(3,1)→(3,2)→(3,3)→(3,4)→(4,4)
        //   Color 4: (1,2)→(1,1)→(2,1)
        //   Color 5: (4,0)→(4,1)→(4,2)→(4,3)
        size: 5,
        grid: [
            [1, 0, 0, 0, 2],
            [3, 0, 4, 1, 0],
            [0, 4, 2, 0, 0],
            [0, 0, 0, 0, 0],
            [5, 0, 0, 5, 3]
        ]
    },
    {
        // Level 3 - 4 colors
        // Solutions:
        //   Color 1: (0,0)→(1,0)→(1,1)→(1,2)→(0,2)
        //   Color 2: (0,4)→(0,3)→(1,3)→(1,4)→(2,4)→(3,4)→(4,4)
        //   Color 3: (4,0)→(3,0)→(2,0)→(2,1)→(2,2)→(2,3)→(3,3)→(3,2)→(3,1)
        //   Color 4: (4,1)→(4,2)→(4,3)
        size: 5,
        grid: [
            [1, 0, 1, 0, 2],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 3, 0, 0, 0],
            [3, 4, 0, 4, 2]
        ]
    }
];

function initGame() {
    loadLevel(currentLevel);
    
    // Set canvas size - make it square based on container width
    sizeCanvas();
    
    window.addEventListener('resize', () => {
        sizeCanvas();
    });
    
    // Event Listeners
    canvas.addEventListener('mousedown', (e) => {
        unlockAudio();
        handleInputStart(e);
    });
    canvas.addEventListener('mousemove', handleInputMove);
    window.addEventListener('mouseup', handleInputEnd);
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        unlockAudio();
        handleInputStart(e.touches[0]);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleInputMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', handleInputEnd);

    resetBtn.addEventListener('click', () => loadLevel(currentLevel));
    
    requestAnimationFrame(gameLoop);
}

function loadLevel(levelIndex) {
    const levelData = LEVELS[levelIndex];
    gridSize = levelData.size;
    grid = levelData.grid.map(row => [...row]);
    
    // Reset paths
    paths = {};
    
    levelDisplay.textContent = levelIndex + 1;
    overlay.classList.remove('visible');
    resizeCanvas();
}

function sizeCanvas() {
    const container = document.getElementById('game-container');
    const maxWidth = container.getBoundingClientRect().width;
    // Measure actual header, mission-brief, and controls heights
    const header = document.querySelector('header');
    const missionBrief = document.getElementById('mission-brief');
    const controls = document.getElementById('controls');
    const containerPadding = parseFloat(getComputedStyle(container).paddingTop) * 2;
    const usedHeight = header.offsetHeight + missionBrief.offsetHeight + controls.offsetHeight + containerPadding + 40; // 40px for margins
    const maxHeight = window.innerHeight - usedHeight;
    const size = Math.max(Math.min(maxWidth, maxHeight), 200); // floor of 200px
    
    canvas.width = size;
    canvas.height = size;
    gameArea.style.width = size + 'px';
    gameArea.style.height = size + 'px';
    
    cellSize = size / gridSize;
    render();
}

function resizeCanvas() {
    sizeCanvas();
}

function getCellFromInput(input) {
    const rect = canvas.getBoundingClientRect();
    const x = input.clientX - rect.left;
    const y = input.clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    return { col, row };
}

function handleInputStart(input) {
    const { col, row } = getCellFromInput(input);
    
    if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) return;
    
    // check if clicking on a start/end dot
    const cellValue = grid[row][col];
    
    if (cellValue > 0) {
        // Check if this dot is the END of a completed path (connected pair)
        // If so, clicking on it should restart the whole color's path from this dot
        // (which resets the connection — the path is no longer complete)
        isDragging = true;
        currentPathColor = cellValue;
        paths[currentPathColor] = [{r: row, c: col}];
    } else {
        // Check if clicking on an existing path
        for (const [colorId, path] of Object.entries(paths)) {
            // Check endpoints of the path to potentially extend it
            const lastPoint = path[path.length - 1];
            if (lastPoint && lastPoint.r === row && lastPoint.c === col) {
                 isDragging = true;
                 currentPathColor = parseInt(colorId);
                 // We kept the path, now we can extend it
                 return;
            }
            // If clicking middle of path, could implement cutting/trimming here
            // For now, simpler: only start from sources or ends
        }
    }
}

function handleInputMove(input) {
    if (!isDragging || !currentPathColor) return;
    
    const { col, row } = getCellFromInput(input);
    
    if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) return;

    const currentPath = paths[currentPathColor];
    let lastPoint = currentPath[currentPath.length - 1];
    
    // 1. Check if we moved to a new cell
    if (lastPoint.r === row && lastPoint.c === col) return;
    
    // Calculate total distance (allows for skipped cells during fast mouse movement)
    const totalDRow = row - lastPoint.r;
    const totalDCol = col - lastPoint.c;
    
    // Only allow movement along one axis at a time (orthogonal)
    // If mouse moved diagonally, pick the dominant axis
    let stepR = 0;
    let stepC = 0;
    if (Math.abs(totalDRow) >= Math.abs(totalDCol)) {
        stepR = totalDRow > 0 ? 1 : -1;
    } else {
        stepC = totalDCol > 0 ? 1 : -1;
    }
    
    // Walk one cell at a time toward the target
    let curR = lastPoint.r;
    let curC = lastPoint.c;
    
    while (true) {
        if (!isDragging || !currentPathColor) break;
        
        const nextR = curR + stepR;
        const nextC = curC + stepC;
        
        // Bounds check
        if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) break;
        
        // Did we reach or pass the target?
        if (stepR !== 0 && ((stepR > 0 && nextR > row) || (stepR < 0 && nextR < row))) break;
        if (stepC !== 0 && ((stepC > 0 && nextC > col) || (stepC < 0 && nextC < col))) break;
        
        // Re-fetch lastPoint since path may have changed
        lastPoint = currentPath[currentPath.length - 1];
        
        // Handling Backtracking
        if (currentPath.length > 1) {
            const prevPoint = currentPath[currentPath.length - 2];
            if (prevPoint.r === nextR && prevPoint.c === nextC) {
                currentPath.pop();
                curR = nextR;
                curC = nextC;
                continue;
            }
        }
        
        // Collision Detection — prevent running into own path
        if (pathContains(currentPath, nextR, nextC)) break;
        
        // Prevent running into other paths
        if (isCellOccupied(nextR, nextC)) break;
        
        // Check if target cell is valid
        const targetValue = grid[nextR][nextC];
        if (targetValue !== 0 && targetValue !== currentPathColor) break;
        
        // All checks passed, add point
        currentPath.push({r: nextR, c: nextC});
        curR = nextR;
        curC = nextC;
        
        // If we reached the matching endpoint, stop dragging immediately
        if (targetValue === currentPathColor) {
            spawnParticles(nextC, nextR, COLORS[currentPathColor]);
            isDragging = false;
            currentPathColor = null;
            checkWinCondition();
            break;
        }
    }
}

function handleInputEnd() {
    isDragging = false;
    currentPathColor = null;
}

// Particles
let particles = [];

function spawnParticles(col, row, color) {
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, cellSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

function pathContains(path, r, c) {
    return path.some(p => p.r === r && p.c === c);
}

function isCellOccupied(r, c) {
    for (const [colorId, path] of Object.entries(paths)) {
        if (parseInt(colorId) === currentPathColor) continue; // Skip self check
        if (pathContains(path, r, c)) return true;
    }
    return false;
}

function checkWinCondition() {
    // 1. Are all colors connected?
    // We check if every color present in the grid has a path that starts and ends at different sources
    // Actually simpler: For each color X, does paths[X] exist and connect two sources?
    
    // Identify required colors from grid
    const requiredColors = new Set();
    grid.forEach(row => row.forEach(val => {
        if (val > 0) requiredColors.add(val);
    }));
    
    let allConnected = true;
    for (const color of requiredColors) {
        const path = paths[color];
        if (!path || path.length < 2) {
            allConnected = false;
            break;
        }
        
        // Check start and end of path match grid sources
        const start = path[0];
        const end = path[path.length - 1];
        
        // A valid path must start at a source and end at a source
        // And those sources must be distinct (not strictly required if logic prevents loops, but good check)
        if (grid[start.r][start.c] !== color || grid[end.r][end.c] !== color) {
            allConnected = false;
            break;
        }
    }
    
    // 2. Is the grid full? (Optional in some versions, usually required for 'Perfect')
    // Let's stick to "All Connected" for now as the primary win condition
    
    if (allConnected) {
        overlay.classList.add('visible');
        gameArea.classList.add('flash-border');
        
        winAudio.currentTime = 0;
        winAudio.volume = 1;
        winAudio.play().then(() => {
            console.log('Win audio playing!');
        }).catch(e => console.log('Audio play failed:', e));
        
        setTimeout(() => {
            currentLevel = (currentLevel + 1) % LEVELS.length;
            loadLevel(currentLevel);
            overlay.classList.remove('visible');
            gameArea.classList.remove('flash-border');
        }, 1500);
    }
}

function gameLoop() {
    updateParticles();
    render();
    requestAnimationFrame(gameLoop);
}


function render() {
    const time = Date.now() / 1000;
    
    // Clear
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid Lines
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    for (let i = 0; i <= gridSize; i++) {
        const pos = i * cellSize;
        ctx.beginPath();
        ctx.moveTo(pos, 0); ctx.lineTo(pos, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos); ctx.lineTo(canvas.width, pos);
        ctx.stroke();
    }
    
    // Draw Paths
    for (const [colorId, path] of Object.entries(paths)) {
        if (!path || path.length < 2) continue;
        
        const color = COLORS[colorId];
        ctx.strokeStyle = color;
        ctx.lineWidth = cellSize * 0.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        const startX = path[0].c * cellSize + cellSize/2;
        const startY = path[0].r * cellSize + cellSize/2;
        ctx.moveTo(startX, startY);
        
        for (let i = 1; i < path.length; i++) {
            const p = path[i];
            const x = p.c * cellSize + cellSize/2;
            const y = p.r * cellSize + cellSize/2;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Draw Static Dots (Sources)
    for(let r = 0; r < gridSize; r++) {
        for(let c = 0; c < gridSize; c++) {
            const cellValue = grid[r][c];
            if (cellValue > 0) {
                // Pulse effect
                let radius = cellSize * 0.25;
                // Add sine wave pulse
                radius += Math.sin(time * 3) * (cellSize * 0.02);
                
                drawDot(c, r, COLORS[cellValue], radius);
            }
        }
    }
    
    drawParticles();
}

function drawDot(col, row, color, radius) {
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

// Start
initGame();

