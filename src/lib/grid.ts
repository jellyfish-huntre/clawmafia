import { GridCell, CellType } from './types';

const REPO_POSITIONS = [
  { x: 3, y: 3 },
  { x: 16, y: 3 },
  { x: 3, y: 11 },
  { x: 16, y: 11 },
];

const COFFEE_STATION = { x: 10, y: 7 };
const SUPABASE_NODE = { x: 5, y: 7 };
const MONGODB_NODE = { x: 14, y: 7 };

export function createInitialGrid(width: number, height: number): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ x, y, type: 'empty', active: true });
    }
    grid.push(row);
  }

  for (const pos of REPO_POSITIONS) {
    if (pos.y < height && pos.x < width) {
      grid[pos.y][pos.x] = { x: pos.x, y: pos.y, type: 'repo', active: true };
    }
  }

  if (COFFEE_STATION.y < height && COFFEE_STATION.x < width) {
    grid[COFFEE_STATION.y][COFFEE_STATION.x] = {
      x: COFFEE_STATION.x, y: COFFEE_STATION.y, type: 'coffee_station', active: true,
    };
  }

  if (SUPABASE_NODE.y < height && SUPABASE_NODE.x < width) {
    grid[SUPABASE_NODE.y][SUPABASE_NODE.x] = {
      x: SUPABASE_NODE.x, y: SUPABASE_NODE.y, type: 'supabase_node', active: true,
    };
  }

  if (MONGODB_NODE.y < height && MONGODB_NODE.x < width) {
    grid[MONGODB_NODE.y][MONGODB_NODE.x] = {
      x: MONGODB_NODE.x, y: MONGODB_NODE.y, type: 'mongodb_node', active: true,
    };
  }

  return grid;
}

export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function findNearestOfType(
  grid: GridCell[][],
  x: number,
  y: number,
  type: CellType,
  activeOnly = true
): GridCell | null {
  let nearest: GridCell | null = null;
  let minDist = Infinity;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === type && (!activeOnly || cell.active)) {
        const dist = manhattanDistance(x, y, cell.x, cell.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = cell;
        }
      }
    }
  }

  return nearest;
}

export function findDistractionsInRange(
  grid: GridCell[][],
  x: number,
  y: number,
  range: number = 5
): GridCell[] {
  const distractions: GridCell[] = [];

  for (const row of grid) {
    for (const cell of row) {
      if (
        (cell.type === 'pizza' || cell.type === 'energy_drink') &&
        cell.active &&
        manhattanDistance(x, y, cell.x, cell.y) <= range
      ) {
        distractions.push(cell);
      }
    }
  }

  return distractions.sort(
    (a, b) => manhattanDistance(x, y, a.x, a.y) - manhattanDistance(x, y, b.x, b.y)
  );
}

export function getNextStepToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  gridWidth: number,
  gridHeight: number
): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (dx === 0 && dy === 0) return { x: fromX, y: fromY };

  let newX = fromX;
  let newY = fromY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    newX += dx > 0 ? 1 : -1;
  } else {
    newY += dy > 0 ? 1 : -1;
  }

  newX = Math.max(0, Math.min(gridWidth - 1, newX));
  newY = Math.max(0, Math.min(gridHeight - 1, newY));

  return { x: newX, y: newY };
}

export function spawnItemAtRandom(
  grid: GridCell[][],
  type: CellType,
  tick: number,
  duration: number = 30
): GridCell | null {
  const emptyCells: GridCell[] = [];

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === 'empty') {
        emptyCells.push(cell);
      }
    }
  }

  if (emptyCells.length === 0) return null;

  const chosen = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const spawned: GridCell = {
    x: chosen.x,
    y: chosen.y,
    type,
    active: true,
    spawnedAt: tick,
    expiresAt: tick + duration,
  };

  grid[chosen.y][chosen.x] = spawned;
  return spawned;
}

export function getAgentSpawnPositions(count: number, gridWidth: number, gridHeight: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const y = gridHeight - 1;
  const spacing = Math.floor(gridWidth / (count + 1));

  for (let i = 0; i < count; i++) {
    positions.push({ x: spacing * (i + 1), y });
  }

  return positions;
}
