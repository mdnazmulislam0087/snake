// Neon Snake with restart-applied settings and persisted high score.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const statusEl = document.getElementById("status");
const effectStatusEl = document.getElementById("effectStatus");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const gridSizeSelect = document.getElementById("gridSizeSelect");
const speedSelect = document.getElementById("speedSelect");
const themeSelect = document.getElementById("themeSelect");

const CANVAS_SIZE = 600;
const SPEED_STEP = 4;
const MIN_SPEED = 60;
const POWER_UP_DURATION_MS = 5000;
const POWER_UP_SPAWN_CHANCE = 0.2;
const SLOW_SPEED_MULTIPLIER = 1.6;
const POWER_UP_TYPES = Object.freeze({
  slow: "slow",
  ghost: "ghost",
});

const STORAGE_KEYS = {
  highScore: "neonSnakeHighScore",
  settings: "neonSnakeSettings",
};

const DEFAULT_SETTINGS = Object.freeze({
  gridSize: 15,
  speed: "normal",
  theme: "neon",
});

const SPEED_PRESETS = Object.freeze({
  slow: 180,
  normal: 140,
  fast: 100,
});

const THEMES = Object.freeze({
  neon: {
    "--bg-1": "#090e29",
    "--bg-2": "#1a1145",
    "--panel": "rgba(8, 12, 34, 0.7)",
    "--text": "#e6ecff",
    "--accent": "#5df2ff",
    "--accent-2": "#ff5de1",
    "--snake-head": "#9aff2e",
    "--snake-body": "#40f9a2",
    "--food": "#ff6b9b",
    "--grid": "rgba(93, 242, 255, 0.08)",
    "--canvas-bg": "rgba(2, 6, 24, 0.95)",
    "--snake-head-glow": "rgba(154, 255, 46, 0.95)",
    "--snake-body-glow": "rgba(64, 249, 162, 0.85)",
    "--food-glow": "rgba(255, 107, 155, 0.95)",
    "--button-grad-1": "rgba(93, 242, 255, 0.15)",
    "--button-grad-2": "rgba(255, 93, 225, 0.15)",
  },
  retro: {
    "--bg-1": "#20140f",
    "--bg-2": "#5b2c15",
    "--panel": "rgba(43, 22, 11, 0.78)",
    "--text": "#ffe7bc",
    "--accent": "#ffd166",
    "--accent-2": "#ff8c42",
    "--snake-head": "#f4ff5d",
    "--snake-body": "#ffb347",
    "--food": "#ff4f6f",
    "--grid": "rgba(255, 209, 102, 0.11)",
    "--canvas-bg": "rgba(30, 15, 7, 0.95)",
    "--snake-head-glow": "rgba(244, 255, 93, 0.92)",
    "--snake-body-glow": "rgba(255, 179, 71, 0.85)",
    "--food-glow": "rgba(255, 79, 111, 0.9)",
    "--button-grad-1": "rgba(255, 209, 102, 0.15)",
    "--button-grad-2": "rgba(255, 140, 66, 0.2)",
  },
  ocean: {
    "--bg-1": "#031524",
    "--bg-2": "#09355c",
    "--panel": "rgba(4, 29, 51, 0.74)",
    "--text": "#d7f4ff",
    "--accent": "#62e4ff",
    "--accent-2": "#4ab0ff",
    "--snake-head": "#66ffd6",
    "--snake-body": "#47d5ff",
    "--food": "#ffd166",
    "--grid": "rgba(98, 228, 255, 0.1)",
    "--canvas-bg": "rgba(2, 22, 38, 0.95)",
    "--snake-head-glow": "rgba(102, 255, 214, 0.92)",
    "--snake-body-glow": "rgba(71, 213, 255, 0.85)",
    "--food-glow": "rgba(255, 209, 102, 0.9)",
    "--button-grad-1": "rgba(98, 228, 255, 0.15)",
    "--button-grad-2": "rgba(74, 176, 255, 0.2)",
  },
});

let snake;
let direction;
let pendingDirection;
let food;
let powerUp;
let score;
let highScore = loadHighScore();
let gameInterval;
let currentSpeed;
let cellSize;
let gridCount;
let effects;
let pausedAt = null;
let isRunning = false;
let isPaused = false;
let hasStarted = false;

// Settings are read from the panel and only applied when restart/start is pressed.
let appliedSettings = loadSettings();

initializeSettingsUI();
applyTheme(appliedSettings.theme);
resetGame();
renderScores();
draw();

startBtn.addEventListener("click", () => {
  appliedSettings = readSettingsFromUI();
  saveSettings(appliedSettings);
  applyTheme(appliedSettings.theme);

  // Restart always starts from a fresh state and applies panel settings.
  resetGame();
  startGame();
});

window.addEventListener("keydown", handleKeydown);

function initializeSettingsUI() {
  gridSizeSelect.value = String(appliedSettings.gridSize);
  speedSelect.value = appliedSettings.speed;
  themeSelect.value = appliedSettings.theme;
}

function readSettingsFromUI() {
  const raw = {
    gridSize: Number.parseInt(gridSizeSelect.value, 10),
    speed: speedSelect.value,
    theme: themeSelect.value,
  };

  return sanitizeSettings(raw);
}

function sanitizeSettings(settings) {
  const safeGridSize = [10, 15, 20].includes(settings.gridSize)
    ? settings.gridSize
    : DEFAULT_SETTINGS.gridSize;

  const safeSpeed = Object.prototype.hasOwnProperty.call(SPEED_PRESETS, settings.speed)
    ? settings.speed
    : DEFAULT_SETTINGS.speed;

  const safeTheme = Object.prototype.hasOwnProperty.call(THEMES, settings.theme)
    ? settings.theme
    : DEFAULT_SETTINGS.theme;

  return {
    gridSize: safeGridSize,
    speed: safeSpeed,
    theme: safeTheme,
  };
}

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES[DEFAULT_SETTINGS.theme];
  const rootStyle = document.documentElement.style;

  Object.entries(theme).forEach(([key, value]) => {
    rootStyle.setProperty(key, value);
  });
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // Ignore storage failures so gameplay continues.
  }
}

function configureGrid(gridSize) {
  gridCount = gridSize;
  cellSize = CANVAS_SIZE / gridCount;
}

function getSpeedFromPreset(preset) {
  return SPEED_PRESETS[preset] || SPEED_PRESETS.normal;
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  if (event.code === "Space") {
    event.preventDefault();
    if (hasStarted) {
      togglePause();
    }
    return;
  }

  const nextDir = getDirectionFromKey(key);
  if (!nextDir || !isRunning || isPaused) return;

  // Prevent reverse turns between ticks when users press quickly.
  if (isReverse(nextDir, pendingDirection)) return;

  pendingDirection = nextDir;
}

function getDirectionFromKey(key) {
  const map = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };
  return map[key] || null;
}

function isReverse(next, current) {
  return next.x === -current.x && next.y === -current.y;
}

function startGame() {
  clearInterval(gameInterval);
  hasStarted = true;
  isRunning = true;
  isPaused = false;
  pausedAt = null;
  setOverlay(false);
  startBtn.textContent = "Restart Game";
  statusEl.textContent = "Running";
  syncTickInterval();
  updateEffectStatus();
}

function resetGame() {
  clearInterval(gameInterval);
  configureGrid(appliedSettings.gridSize);

  // Spawn snake near center and aligned for rightward movement.
  const centerX = Math.floor(gridCount / 2);
  const centerY = Math.floor(gridCount / 2);
  snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];

  direction = { x: 1, y: 0 };
  pendingDirection = { ...direction };
  powerUp = null;
  food = spawnFood(snake, powerUp);
  score = 0;
  currentSpeed = getSpeedFromPreset(appliedSettings.speed);
  effects = {
    slowUntil: 0,
    ghostUntil: 0,
  };
  pausedAt = null;

  isRunning = false;
  isPaused = false;
  hasStarted = false;
  statusEl.textContent = "Ready";
  updateEffectStatus();
  renderScores();
  setOverlay(true, "Neon Snake", "Press Start Game to begin.");
  draw();
}

function togglePause() {
  if (!isRunning) return;

  isPaused = !isPaused;
  if (isPaused) {
    pausedAt = Date.now();
    clearInterval(gameInterval);
    statusEl.textContent = "Paused";
    setOverlay(true, "Paused", "Press Spacebar to resume.");
  } else {
    shiftEffectTimersAfterPause();
    pausedAt = null;
    statusEl.textContent = "Running";
    setOverlay(false);
    syncTickInterval();
  }
}

function tick() {
  const wasSlowActive = isSlowActive();
  direction = { ...pendingDirection };

  const head = snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };
  const willGrow = nextHead.x === food.x && nextHead.y === food.y;
  const pickedPowerUp =
    powerUp && nextHead.x === powerUp.x && nextHead.y === powerUp.y;

  if (isCollision(nextHead, willGrow)) {
    gameOver();
    return;
  }

  snake.unshift(nextHead);

  if (willGrow) {
    score += 10;
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }

    renderScores();
    food = spawnFood(snake, powerUp);
    maybeSpawnPowerUp();
    increaseSpeed();
  } else {
    snake.pop();
  }

  if (pickedPowerUp) {
    activatePowerUp(powerUp.type);
    powerUp = null;
  }

  if (wasSlowActive !== isSlowActive()) {
    syncTickInterval();
  }

  updateEffectStatus();
  draw();
}

function increaseSpeed() {
  const nextSpeed = Math.max(MIN_SPEED, currentSpeed - SPEED_STEP);
  if (nextSpeed === currentSpeed) return;

  currentSpeed = nextSpeed;
  syncTickInterval();
}

function getEffectiveSpeed() {
  if (isSlowActive()) {
    return Math.round(currentSpeed * SLOW_SPEED_MULTIPLIER);
  }
  return currentSpeed;
}

function syncTickInterval() {
  if (!isRunning || isPaused) return;
  clearInterval(gameInterval);
  gameInterval = setInterval(tick, getEffectiveSpeed());
}

function isCollision(cell, growing = false) {
  const outsideBoard =
    cell.x < 0 || cell.y < 0 || cell.x >= gridCount || cell.y >= gridCount;

  if (outsideBoard) return true;
  if (isGhostActive()) return false;

  // If not growing, tail moves this tick, so skip current tail segment.
  const checkLength = growing ? snake.length : snake.length - 1;
  for (let i = 0; i < checkLength; i++) {
    if (snake[i].x === cell.x && snake[i].y === cell.y) return true;
  }
  return false;
}

function spawnFood(currentSnake, currentPowerUp = null) {
  let newFood;
  do {
    newFood = {
      x: Math.floor(Math.random() * gridCount),
      y: Math.floor(Math.random() * gridCount),
    };
  } while (
    (currentPowerUp &&
      currentPowerUp.x === newFood.x &&
      currentPowerUp.y === newFood.y) ||
    currentSnake.some(
      (segment) => segment.x === newFood.x && segment.y === newFood.y,
    )
  );

  return newFood;
}

function spawnPowerUp(currentSnake, currentFood) {
  let newPowerUp;
  const type =
    Math.random() < 0.5 ? POWER_UP_TYPES.slow : POWER_UP_TYPES.ghost;

  do {
    newPowerUp = {
      x: Math.floor(Math.random() * gridCount),
      y: Math.floor(Math.random() * gridCount),
      type,
    };
  } while (
    (currentFood.x === newPowerUp.x && currentFood.y === newPowerUp.y) ||
    currentSnake.some(
      (segment) => segment.x === newPowerUp.x && segment.y === newPowerUp.y,
    )
  );

  return newPowerUp;
}

function maybeSpawnPowerUp() {
  if (powerUp) return;
  if (Math.random() >= POWER_UP_SPAWN_CHANCE) return;
  powerUp = spawnPowerUp(snake, food);
}

function activatePowerUp(type) {
  const now = Date.now();
  if (type === POWER_UP_TYPES.slow) {
    effects.slowUntil = now + POWER_UP_DURATION_MS;
  } else if (type === POWER_UP_TYPES.ghost) {
    effects.ghostUntil = now + POWER_UP_DURATION_MS;
  }
  syncTickInterval();
}

function isSlowActive() {
  return Date.now() < effects.slowUntil;
}

function isGhostActive() {
  return Date.now() < effects.ghostUntil;
}

function shiftEffectTimersAfterPause() {
  if (!pausedAt) return;
  const pauseDelta = Date.now() - pausedAt;
  if (effects.slowUntil > pausedAt) effects.slowUntil += pauseDelta;
  if (effects.ghostUntil > pausedAt) effects.ghostUntil += pauseDelta;
}

function updateEffectStatus() {
  const now = Date.now();
  const labels = [];
  const slowRemaining = Math.ceil((effects.slowUntil - now) / 1000);
  const ghostRemaining = Math.ceil((effects.ghostUntil - now) / 1000);

  if (slowRemaining > 0) labels.push(`SLOW ${slowRemaining}s`);
  if (ghostRemaining > 0) labels.push(`GHOST ${ghostRemaining}s`);

  effectStatusEl.textContent =
    labels.length > 0 ? labels.join(" | ") : "Power-up: none";
}

function gameOver() {
  clearInterval(gameInterval);
  isRunning = false;
  isPaused = false;
  pausedAt = null;
  statusEl.textContent = "Game Over";
  updateEffectStatus();
  setOverlay(
    true,
    "Game Over",
    `Final Score: ${score}. High Score: ${highScore}. Press Restart Game.`,
  );
}

function setOverlay(show, title = "", text = "") {
  overlay.classList.toggle("hidden", !show);
  if (title) overlayTitle.textContent = title;
  if (text) overlayText.textContent = text;
}

function loadHighScore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.highScore);
    const parsed = Number.parseInt(raw || "0", 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.highScore, String(value));
  } catch {
    // Ignore storage failures so gameplay continues.
  }
}

function renderScores() {
  scoreEl.textContent = `Score: ${score || 0}`;
  highScoreEl.textContent = `High Score: ${highScore}`;
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawGrid();
  drawFood();
  drawPowerUp();
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridCount; i++) {
    const pos = i * cellSize;

    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, CANVAS_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(CANVAS_SIZE, pos);
    ctx.stroke();
  }
}

function drawSnake() {
  const rootStyle = getComputedStyle(document.documentElement);
  const snakeHeadColor = rootStyle.getPropertyValue("--snake-head").trim();
  const snakeBodyColor = rootStyle.getPropertyValue("--snake-body").trim();
  const snakeHeadGlow = rootStyle.getPropertyValue("--snake-head-glow").trim();
  const snakeBodyGlow = rootStyle.getPropertyValue("--snake-body-glow").trim();

  snake.forEach((segment, index) => {
    const isHead = index === 0;
    const x = segment.x * cellSize;
    const y = segment.y * cellSize;

    ctx.fillStyle = isHead ? snakeHeadColor : snakeBodyColor;
    ctx.shadowColor = isHead ? snakeHeadGlow : snakeBodyGlow;
    ctx.shadowBlur = isHead ? 18 : 12;

    const radius = Math.max(3, Math.floor(cellSize * 0.25));
    roundRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, radius);
    ctx.fill();
  });

  ctx.shadowBlur = 0;
}

function drawFood() {
  const rootStyle = getComputedStyle(document.documentElement);
  const foodColor = rootStyle.getPropertyValue("--food").trim();
  const foodGlow = rootStyle.getPropertyValue("--food-glow").trim();
  const x = food.x * cellSize + cellSize / 2;
  const y = food.y * cellSize + cellSize / 2;

  ctx.fillStyle = foodColor;
  ctx.shadowColor = foodGlow;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, cellSize * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPowerUp() {
  if (!powerUp) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const accentColor = rootStyle.getPropertyValue("--accent").trim();
  const accentTwoColor = rootStyle.getPropertyValue("--accent-2").trim();
  const powerColor =
    powerUp.type === POWER_UP_TYPES.slow ? accentColor : accentTwoColor;
  const x = powerUp.x * cellSize + cellSize / 2;
  const y = powerUp.y * cellSize + cellSize / 2;
  const size = cellSize * 0.32;

  ctx.fillStyle = powerColor;
  ctx.shadowColor = powerColor;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
