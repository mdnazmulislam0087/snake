// Neon Snake game using a 600x600 canvas and fixed grid movement.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const CANVAS_SIZE = 600;
const CELL_SIZE = 20;
const GRID_COUNT = CANVAS_SIZE / CELL_SIZE;

const INITIAL_SPEED = 140; // milliseconds per tick
const MIN_SPEED = 70;
const SPEED_STEP = 4;

let snake;
let direction;
let pendingDirection;
let food;
let score;
let gameInterval;
let currentSpeed;
let isRunning = false;
let isPaused = false;
let hasStarted = false;

// Start in a clean state and draw the board once.
resetGame();
draw();

startBtn.addEventListener("click", () => {
  // Always restart from a clean state so post-game restart works correctly.
  resetGame();
  startGame();
});

window.addEventListener("keydown", handleKeydown);

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  // Pause/Resume with Spacebar (only after game has started).
  if (event.code === "Space") {
    event.preventDefault();
    if (hasStarted) {
      togglePause();
    }
    return;
  }

  const nextDir = getDirectionFromKey(key);
  if (!nextDir || !isRunning || isPaused) return;

  // Prevent reversing direction by checking against pending direction,
  // so rapid key presses between ticks cannot create illegal reversals.
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
  setOverlay(false);
  startBtn.textContent = "Restart Game";
  statusEl.textContent = "Running";
  gameInterval = setInterval(tick, currentSpeed);
}

function resetGame() {
  clearInterval(gameInterval);

  // Snake begins near center with length 3.
  snake = [
    { x: 14, y: 15 },
    { x: 13, y: 15 },
    { x: 12, y: 15 },
  ];

  direction = { x: 1, y: 0 };
  pendingDirection = { ...direction };
  food = spawnFood(snake);
  score = 0;
  currentSpeed = INITIAL_SPEED;

  isRunning = false;
  isPaused = false;
  hasStarted = false;
  statusEl.textContent = "Ready";
  scoreEl.textContent = "Score: 0";
  setOverlay(true, "Neon Snake", "Press Start Game to begin.");
}

function togglePause() {
  if (!isRunning) return;

  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(gameInterval);
    statusEl.textContent = "Paused";
    setOverlay(true, "Paused", "Press Spacebar to resume.");
  } else {
    statusEl.textContent = "Running";
    setOverlay(false);
    gameInterval = setInterval(tick, currentSpeed);
  }
}

function tick() {
  direction = { ...pendingDirection };

  const head = snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };
  const willGrow = nextHead.x === food.x && nextHead.y === food.y;

  if (isCollision(nextHead, willGrow)) {
    gameOver();
    return;
  }

  snake.unshift(nextHead);

  // Eat food: grow snake, increase score, and slightly speed up game.
  if (willGrow) {
    score += 10;
    scoreEl.textContent = `Score: ${score}`;
    food = spawnFood(snake);
    increaseSpeed();
  } else {
    snake.pop();
  }

  draw();
}

function increaseSpeed() {
  const nextSpeed = Math.max(MIN_SPEED, currentSpeed - SPEED_STEP);
  if (nextSpeed === currentSpeed) return;

  currentSpeed = nextSpeed;

  // Restart interval so the new speed is applied immediately.
  clearInterval(gameInterval);
  gameInterval = setInterval(tick, currentSpeed);
}

function isCollision(cell, growing = false) {
  const outsideBoard =
    cell.x < 0 || cell.y < 0 || cell.x >= GRID_COUNT || cell.y >= GRID_COUNT;

  if (outsideBoard) return true;

  // If not growing, the tail moves away this tick, so ignore the current tail
  // position when checking self-collision.
  const checkLength = growing ? snake.length : snake.length - 1;
  for (let i = 0; i < checkLength; i++) {
    if (snake[i].x === cell.x && snake[i].y === cell.y) return true;
  }
  return false;
}

function spawnFood(currentSnake) {
  let newFood;
  do {
    newFood = {
      x: Math.floor(Math.random() * GRID_COUNT),
      y: Math.floor(Math.random() * GRID_COUNT),
    };
  } while (currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y));

  return newFood;
}

function gameOver() {
  clearInterval(gameInterval);
  isRunning = false;
  isPaused = false;
  statusEl.textContent = "Game Over";
  setOverlay(true, "Game Over", `Final Score: ${score}. Press Restart Game.`);
}

function setOverlay(show, title = "", text = "") {
  overlay.classList.toggle("hidden", !show);
  if (title) overlayTitle.textContent = title;
  if (text) overlayText.textContent = text;
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawGrid();
  drawFood();
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
  ctx.lineWidth = 1;

  for (let i = 0; i <= GRID_COUNT; i++) {
    const pos = i * CELL_SIZE;

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
  const snakeHeadColor = getComputedStyle(document.documentElement).getPropertyValue("--snake-head").trim();
  const snakeBodyColor = getComputedStyle(document.documentElement).getPropertyValue("--snake-body").trim();

  snake.forEach((segment, index) => {
    const isHead = index === 0;
    const x = segment.x * CELL_SIZE;
    const y = segment.y * CELL_SIZE;

    ctx.fillStyle = isHead ? snakeHeadColor : snakeBodyColor;
    ctx.shadowColor = isHead ? "rgba(154, 255, 46, 0.95)" : "rgba(64, 249, 162, 0.85)";
    ctx.shadowBlur = isHead ? 18 : 12;

    // Rounded body segments for a modern neon look.
    const radius = 5;
    roundRect(ctx, x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, radius);
    ctx.fill();
  });

  // Reset shadow so other objects render cleanly.
  ctx.shadowBlur = 0;
}

function drawFood() {
  const foodColor = getComputedStyle(document.documentElement).getPropertyValue("--food").trim();
  const x = food.x * CELL_SIZE + CELL_SIZE / 2;
  const y = food.y * CELL_SIZE + CELL_SIZE / 2;

  ctx.fillStyle = foodColor;
  ctx.shadowColor = "rgba(255, 107, 155, 0.95)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, CELL_SIZE * 0.35, 0, Math.PI * 2);
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
