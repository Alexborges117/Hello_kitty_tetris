// ========== SELEÇÃO DE ELEMENTOS DOM ==========
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const muteIcon = document.getElementById('muteIcon');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');

// ========== SISTEMA DE ÁUDIO ==========
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {
  move: null,
  rotate: null,
  land: null,
  clear: null,
  pause: null,
  unpause: null,
  music: null
};

// ========== CONFIGURAÇÕES DO JOGO ==========
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = {
  cinnamoroll: '#9dd6f7',
  hello_kitty: '#871a4d',
  kuromi: '#8f65c2',
  my_melody: '#f49ac1',
  pompompurin: '#fcd778'
};


// ========== SISTEMA DE PONTUAÇÃO ==========
const SCORE_KEY = 'helloKittyTetrisScores';

function getScores() {
  const scores = localStorage.getItem(SCORE_KEY);
  return scores ? JSON.parse(scores) : [];
}

function saveScore(newScore) {
  const scores = getScores();
  scores.push(newScore);
  // Mantém apenas as 10 melhores pontuações (ordenadas da maior para menor)
  const topScores = scores.sort((a, b) => b - a).slice(0, 10);
  localStorage.setItem(SCORE_KEY, JSON.stringify(topScores));
}

// ========== ESTADOS DO JOGO ==========
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
let currentPiece = null;
let nextPiece = null;
let score = 0;
let gameOver = false;
let isPaused = false;
let isMuted = false;
let dropInterval = 1000;
let lastTime = 0;
let dropCounter = 0;
let mouseX = 0;
let mouseY = 0;
let backgroundMusic = null;
const sprites = {};

// ========== DEFINIÇÃO DAS PEÇAS ==========
const PIECES = {
  I: { shape: [[1, 1, 1, 1]], character: 'cinnamoroll' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], character: 'hello_kitty' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], character: 'kuromi' },
  O: { shape: [[1, 1], [1, 1]], character: 'my_melody' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], character: 'pompompurin' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], character: 'cinnamoroll' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], character: 'hello_kitty' }
};

// ========== FUNÇÕES DE CARREGAMENTO ==========
function showLoadingScreen() {
  const loading = document.getElementById('loadingScreen');
  if (loading) loading.style.display = 'flex';
}

function hideLoadingScreen() {
  const loading = document.getElementById('loadingScreen');
  if (loading) loading.style.display = 'none';
}

async function loadAudio() {
  const audioFiles = {
    move: '../msc/move.wav',
    rotate: '../msc/rotate.wav',
    land: '../msc/land.wav',
    clear: '../msc/clear.wav',
    pause: '../msc/pause.wav',
    unpause: '../msc/unpause.wav',
    music: '../msc/musica_tema.mp3'
  };

  for (const [key, url] of Object.entries(audioFiles)) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      sounds[key] = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error(`Erro ao carregar áudio ${key}:`, error);
    }
  }
}

async function loadSprites() {
  const characters = Object.keys(COLORS);
  const loadPromises = characters.map(character => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = `../sprites/${character}.png`;
      img.onload = () => {
        sprites[character] = img;
        resolve();
      };
      img.onerror = () => {
        console.error(`Erro ao carregar sprite: ${character}.png`);
        resolve();
      };
    });
  });

  await Promise.all(loadPromises);
}

// ========== FUNÇÕES DE ÁUDIO ==========
function playSound(sound, volume = 0.5, loop = false) {
  if (!sounds[sound] || isMuted || (isPaused && sound !== 'unpause')) return;

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  
  source.buffer = sounds[sound];
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  gainNode.gain.value = volume;
  source.loop = loop;
  source.start(0);
  
  return source;
}

function playBackgroundMusic() {
  if (backgroundMusic) {
    backgroundMusic.stop();
    backgroundMusic = null;
  }

  if (audioContext.state === 'suspended') {
  audioContext.resume().catch(e => console.error('AudioContext resume failed:', e));
}
  
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      backgroundMusic = playSound('music', 0.3, true);
    });
  } else {
    backgroundMusic = playSound('music', 0.3, true);
  }
}

// ========== FUNÇÕES DO JOGO ==========
function createPiece(type) {
  const pieceKeys = Object.keys(PIECES);
  const randomType = pieceKeys[Math.floor(Math.random() * pieceKeys.length)];
  const selectedType = type || randomType;
  const piece = PIECES[selectedType];
  
  return {
    position: { 
      x: Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2), 
      y: 0 
    },
    shape: piece.shape,
    character: piece.character
  };
}

function spawnPiece() {
  currentPiece = nextPiece || createPiece();
  nextPiece = createPiece();
  drawNextPiece();

  console.log('Current piece after spawn:', currentPiece);
}

function resetGame() {
  // Limpa o tabuleiro
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  score = 0;
  scoreElement.textContent = score;
  gameOver = false;
  isPaused = false;
  pauseBtn.textContent = 'PAUSE';
  dropInterval = 1000;
  
  // Reinicia as variáveis de tempo
  lastTime = 0;
  dropCounter = 0;
  
  // Esconde a tela de game over
  hideGameOverScreen();
  
  // Reinicia as peças
  nextPiece = createPiece(); // Garante que nextPiece existe
  spawnPiece();
  
  // Reinicia a música
  if (backgroundMusic) {
    backgroundMusic.stop();
    backgroundMusic = null;
  }
  
  if (!isMuted) {
    playBackgroundMusic();
  }
  
  // Força um redesenho imediato
  drawBoard();
  
  // Se a animação estava parada, reinicia
  if (!gameOver && !isPaused) {
    requestAnimationFrame(update);
  }
}

function showGameOverScreen() {
  if (gameOverScreen && finalScoreElement) {
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'flex';
    
    // Salva a pontuação quando o jogo termina
    saveScore(score);
    
    // Pausa a música quando o jogo termina
    if (backgroundMusic) {
      backgroundMusic.stop();
    }
  }
}
function calculateShadowPosition() {
  if (!currentPiece) return null;
  
  const shadow = JSON.parse(JSON.stringify(currentPiece));
  while (!collision(shadow)) {
    shadow.position.y++;
  }
  shadow.position.y--;
  return shadow;
}

function collision(piece = currentPiece) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardX = piece.position.x + x;
        const boardY = piece.position.y + y;
        
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS || 
            (boardY >= 0 && board[boardY][boardX])) {
          return true;
        }
      }
    }
  }
  return false;
}

function rotate() {
  const originalShape = currentPiece.shape;
  const rows = currentPiece.shape.length;
  const cols = currentPiece.shape[0].length;
  const newShape = Array(cols).fill().map(() => Array(rows).fill(0));
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newShape[x][rows - 1 - y] = currentPiece.shape[y][x];
    }
  }
  
  currentPiece.shape = newShape;
  if (collision()) currentPiece.shape = originalShape;
}

function merge() {
  currentPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = currentPiece.position.y + y;
        if (boardY >= 0) {
          board[boardY][currentPiece.position.x + x] = {
            character: currentPiece.character
          };
        }
      }
    });
  });
}


// ========== FUNÇÕES DE DESENHO ==========
function drawBlock(x, y, character, isCurrent = false, isNextPiece = false) {
  const context = isNextPiece ? nextCtx : ctx;
  const sprite = sprites[character];

  if (sprite?.complete) {
    context.drawImage(
      sprite,
      x * BLOCK_SIZE,
      y * BLOCK_SIZE,
      BLOCK_SIZE,
      BLOCK_SIZE
    );
  } else {
    context.fillStyle = COLORS[character] || '#ccc';
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  }

  if (isCurrent) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  }
}

function drawGrid() {
  ctx.fillStyle = '#fff9fc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.strokeStyle = '#ffd0e6';
  ctx.lineWidth = 0.5;
  
  // Linhas verticais
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK_SIZE, 0);
    ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    ctx.stroke();
  }
  
  // Linhas horizontais
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK_SIZE);
    ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
    ctx.stroke();
  }
}

function drawShadow() {
  const shadow = calculateShadowPosition();
  if (!shadow) return;
  
  ctx.save();
  ctx.globalAlpha = 0.3;
  
  shadow.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        ctx.fillStyle = COLORS[currentPiece.character];
        ctx.beginPath();
        ctx.roundRect(
          (shadow.position.x + x) * BLOCK_SIZE + 2,
          (shadow.position.y + y) * BLOCK_SIZE + 2,
          BLOCK_SIZE - 4,
          BLOCK_SIZE - 4,
          4
        );
        ctx.fill();
      }
    });
  });
  
  ctx.restore();
}

function drawBoard() {
  drawGrid();
  drawShadow();
  
  // Peças fixadas
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        drawBlock(x, y, board[y][x].character);
      }
    }
  }
  
  // Peça atual
  if (currentPiece) {
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawBlock(
            currentPiece.position.x + x,
            currentPiece.position.y + y,
            currentPiece.character,
            true
          );
        }
      });
    });
  }
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = '#ffe6f0';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  
  if (nextPiece) {
    const offsetX = (nextCanvas.width / BLOCK_SIZE - nextPiece.shape[0].length) / 2;
    const offsetY = (nextCanvas.height / BLOCK_SIZE - nextPiece.shape.length) / 2;
    
    nextPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawBlock(
            offsetX + x,
            offsetY + y,
            nextPiece.character,
            false,
            true
          );
        }
      });
    });
  }
}

// ========== LÓGICA DO JOGO ==========
function movePiece(direction) {
  if (gameOver || isPaused) return;
  
  switch (direction) {
    case 'left':
      currentPiece.position.x--;
      if (collision()) currentPiece.position.x++;
      else playSound('move', 0.3);
      break;
      
    case 'right':
      currentPiece.position.x++;
      if (collision()) currentPiece.position.x--;
      else playSound('move', 0.3);
      break;
      
    case 'down':
      currentPiece.position.y++;
      if (collision()) {
        currentPiece.position.y--;
        playSound('land', 0.5);
        merge();
        clearLines();
        spawnPiece();
        if (collision()) {
          gameOver = true;
          showGameOverScreen();
        }
      }
      dropCounter = 0;
      break;
      
    case 'rotate':
      rotate();
      playSound('rotate', 0.4);
      break;
      
    case 'drop':
      while (!collision()) currentPiece.position.y++;
      currentPiece.position.y--;
      playSound('land', 0.5);
      merge();
      clearLines();
      spawnPiece();
      if (collision()) {
        gameOver = true;
        showGameOverScreen();
      }
      dropCounter = 0;
      break;
  }
}

async function clearLines() {
  let linesToClear = [];
  
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== null)) {
      linesToClear.push(y);
    }
  }

  if (linesToClear.length > 0) {
    playSound('clear', 0.6);
    await flashLines(linesToClear);
    
    linesToClear.sort((a, b) => b - a);
    for (const y of linesToClear) board.splice(y, 1);
    for (let i = 0; i < linesToClear.length; i++) board.unshift(Array(COLS).fill(null));
    
    const linePoints = [0, 100, 300, 500, 800];
    score += linePoints[Math.min(linesToClear.length, 4)];
    scoreElement.textContent = score;
    
    dropInterval = Math.max(100, dropInterval - (linesToClear.length * 50));
  }
}

async function flashLines(lines) {
  return new Promise(resolve => {
    const flashColor = '#ffffff';
    const flashes = 3;
    let flashCount = 0;
    let isWhite = false;

    function flash() {
      isWhite = !isWhite;
      drawGrid();

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (board[y][x]) {
            if (lines.includes(y) && isWhite) {
              ctx.fillStyle = flashColor;
              ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            } else {
              drawBlock(x, y, board[y][x].character);
            }
          }
        }
      }

      flashCount++;
      if (flashCount < flashes * 2) setTimeout(flash, 150);
      else resolve();
    }

    flash();
  });
}

function updatePiecePositionFromMouse() {
  if (!currentPiece || gameOver || isPaused) return;
  
  const rect = canvas.getBoundingClientRect();
  const targetX = Math.floor((mouseX - rect.left) / BLOCK_SIZE);
  const pieceWidth = currentPiece.shape[0].length;
  const targetPieceX = Math.max(0, Math.min(
    targetX - Math.floor(pieceWidth / 2),
    COLS - pieceWidth
  ));
  
  const dx = targetPieceX - currentPiece.position.x;
  if (Math.abs(dx) > 0) {
    currentPiece.position.x += Math.sign(dx);
    if (collision()) currentPiece.position.x -= Math.sign(dx);
  }
}

function update(time = 0) {
  if (gameOver) return;
  
  const deltaTime = time - lastTime;
  lastTime = time;
  
  if (!isPaused) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      movePiece('down');
    }
    updatePiecePositionFromMouse();
  }
  
  drawBoard();
  requestAnimationFrame(update);
}

// ========== INTERFACE ==========
function showGameOverScreen() {
  if (gameOverScreen && finalScoreElement) {
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = 'flex';
  }
}

function hideGameOverScreen() {
  if (gameOverScreen) {
    gameOverScreen.style.display = 'none';
  }
}

function togglePause() {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? 'CONTINUE' : 'PAUSE';
  playSound(isPaused ? 'pause' : 'unpause', 0.5);
  if (isPaused) audioContext.suspend();
  else audioContext.resume();
}

function toggleMute() {
  isMuted = !isMuted;
  muteIcon.classList.replace(
    isMuted ? 'fa-volume-up' : 'fa-volume-mute',
    isMuted ? 'fa-volume-mute' : 'fa-volume-up'
  );
  if (isMuted) audioContext.suspend();
  else audioContext.resume();
}

// ========== CONTROLES ==========
function handleKeyPress(e) {
  if (gameOver) return;
  
  switch (e.keyCode) {
    case 37: movePiece('left'); break;    // Seta esquerda
    case 39: movePiece('right'); break;   // Seta direita
    case 40: movePiece('down'); break;    // Seta baixo
    case 38: movePiece('rotate'); break;  // Seta cima
    case 32: movePiece('drop'); break;    // Espaço
    case 80: togglePause(); break;        // Tecla P
  }
}

// ========== INICIALIZAÇÃO ==========
async function init() {
  showLoadingScreen();
  
  try {
    // Configura os canvases
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    nextCanvas.width = 4 * BLOCK_SIZE;
    nextCanvas.height = 4 * BLOCK_SIZE;

    // Carrega recursos
    await Promise.all([loadSprites(), loadAudio()]);
    
    // Configura eventos
    document.addEventListener('keydown', handleKeyPress);
    canvas.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    canvas.addEventListener('click', () => {
      if (!gameOver && !isPaused) movePiece('rotate');
    });
    
    restartBtn.addEventListener('click', resetGame);
    menuBtn.addEventListener('click', () => window.location.href = '../index.html');
    muteBtn.addEventListener('click', toggleMute);
    pauseBtn.addEventListener('click', togglePause);
    
    // Inicia o jogo
    resetGame();
    update();
    
  } catch (error) {
    console.error("Erro na inicialização:", error);
    alert("Erro ao carregar o jogo. Recarregue a página.");
  } finally {
    hideLoadingScreen();
  }
}

document.getElementById('menuBtn1').addEventListener('click', () => {
  window.location.href = '../index.html'; 
});

// Inicia o jogo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);