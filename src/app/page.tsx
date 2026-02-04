"use client";

import { useEffect, useState, useRef } from "react";

type GridCell = {
  x: number;
  y: number;
  type: string;
  active: boolean;
  spawnedAt?: number;
  expiresAt?: number;
};

type AgentInfo = {
  id: string;
  name: string;
  x: number;
  y: number;
  state: string;
  commits: number;
  hasHeadphones: boolean;
  coffeeTime: number;
  forcePushCount: number;
};

type GameEvent = {
  agentId: string;
  agentName: string;
  action: string;
  detail: string;
  tick: number;
  timestamp: string;
};

type GameState = {
  id: string;
  phase: string;
  subPhase: string;
  tickCount: number;
  maxTicks: number;
  timeRemainingPercent: number;
  featureProgress: number;
  totalCommits: number;
  targetCommits: number;
  outcome: string | null;
  grid: GridCell[][];
  agents: AgentInfo[];
  logs: string[];
  events: GameEvent[];
  currentActorName?: string | null;
  currentActorState?: string | null;
};

const CELL_ICONS: Record<string, string> = {
  repo: "G",
  coffee_station: "C",
  supabase_node: "S",
  mongodb_node: "M",
  pizza: "P",
  energy_drink: "E",
  headphones: "H",
  empty: "",
};

const CELL_COLORS: Record<string, string> = {
  repo: "bg-green-800 border-green-600",
  coffee_station: "bg-amber-900 border-amber-700",
  supabase_node: "bg-teal-800 border-teal-600",
  mongodb_node: "bg-emerald-800 border-emerald-600",
  pizza: "bg-yellow-700 border-yellow-500",
  energy_drink: "bg-blue-700 border-blue-500",
  headphones: "bg-purple-700 border-purple-500",
  empty: "bg-slate-900/50 border-slate-800/50",
};

const STATE_COLORS: Record<string, string> = {
  coding: "border-green-400 bg-green-900/40",
  distracted: "border-yellow-400 bg-yellow-900/40",
  panicking: "border-red-400 bg-red-900/40",
  merge_conflict: "border-gray-400 bg-gray-900/40",
  idle: "border-slate-400 bg-slate-900/40",
};

function useBaseUrl() {
  const [baseUrl, setBaseUrl] = useState("");
  useEffect(() => {
    setBaseUrl(typeof window !== "undefined" ? window.location.origin : "");
  }, []);
  return baseUrl;
}

export default function Home() {
  const [games, setGames] = useState<GameState[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [lobbyCount, setLobbyCount] = useState<number>(0);
  const [envAction, setEnvAction] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const baseUrl = useBaseUrl();

  const fetchSystemState = async () => {
    try {
      const res = await fetch("/api/debug/state");
      if (res.ok) {
        const data = await res.json();
        setGames(data.games);
        setLobbyCount(data.lobbyCount);
      }
    } catch (e) {
      console.error("Failed to fetch state", e);
    }
  };

  useEffect(() => {
    fetchSystemState();
    const interval = setInterval(fetchSystemState, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [games]);

  const resetSystem = async () => {
    await fetch("/api/game/reset", { method: "POST" });
    fetchSystemState();
    setSelectedGameId(null);
  };

  const selectedGame = games.find((g) => g.id === selectedGameId) || games[0];

  useEffect(() => {
    if (!selectedGameId && games.length > 0) {
      setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId]);

  const handleGridClick = async (x: number, y: number) => {
    if (!envAction || !selectedGame) return;

    try {
      await fetch("/api/game/environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGame.id, action: envAction, x, y }),
      });
    } catch (e) {
      console.error("Environment action failed", e);
    }
    setEnvAction(null);
  };

  const handleServerCrash = async () => {
    if (!selectedGame) return;
    try {
      await fetch("/api/game/environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGame.id, action: "server_crash" }),
      });
    } catch (e) {
      console.error("Server crash failed", e);
    }
  };

  const getAgentAt = (x: number, y: number): AgentInfo | undefined => {
    return selectedGame?.agents.find((a) => a.x === x && a.y === y);
  };

  const timePercent = selectedGame?.timeRemainingPercent ?? 100;
  const isCrunchTime = selectedGame?.subPhase === "CRUNCH_TIME";

  return (
    <main className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex overflow-hidden">
      {/* Panic strobe overlay */}
      {isCrunchTime && selectedGame?.phase === "HACKING" && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-red-500 animate-panic-strobe" />
      )}

      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-slate-100 tracking-wider">CRUNCH TIME</h1>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-500">Ghost-Commit Simulator</span>
            <button
              type="button"
              onClick={resetSystem}
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Lobby */}
          <div className="mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Lobby ({lobbyCount})</h2>
            <div className="bg-slate-800/50 rounded p-3 text-center border border-slate-800 border-dashed">
              <span className="text-2xl font-mono text-slate-400">{lobbyCount}</span>
              <div className="text-[10px] text-slate-600">Waiting (3 to start)</div>
            </div>
          </div>

          {/* Games List */}
          <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Games ({games.length})</h2>
          <div className="space-y-2 mb-4">
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => setSelectedGameId(game.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  selectedGameId === game.id
                    ? "bg-blue-900/40 border-blue-500/60 shadow-lg shadow-blue-500/20"
                    : "bg-slate-800 border-slate-700 hover:border-blue-400/50"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-300">#{game.id.slice(-4)}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      game.phase === "GAME_OVER"
                        ? "bg-slate-700 text-slate-400"
                        : game.subPhase === "CRUNCH_TIME"
                        ? "bg-red-900 text-red-300"
                        : "bg-green-900 text-green-300"
                    }`}
                  >
                    {game.phase === "GAME_OVER" ? (game.outcome === "WIN" ? "WON" : "LOST") : game.subPhase === "CRUNCH_TIME" ? "CRUNCH" : "HACKING"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>{Math.round(game.featureProgress)}% done</span>
                  <span>{game.agents.length} devs</span>
                </div>
                {game.phase === "HACKING" && (
                  <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${game.featureProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            {games.length === 0 && (
              <div className="text-slate-600 text-sm italic text-center py-4">No active games</div>
            )}
          </div>

          {/* Environment Controls */}
          {selectedGame && selectedGame.phase === "HACKING" && (
            <div className="mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Environment</h2>
              <div className="space-y-1.5">
                <button
                  onClick={() => setEnvAction(envAction === "place_headphones" ? null : "place_headphones")}
                  className={`w-full text-xs p-2 rounded border transition-all ${
                    envAction === "place_headphones"
                      ? "bg-purple-900 border-purple-500 text-purple-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500/50"
                  }`}
                >
                  H Headphones
                </button>
                <button
                  onClick={handleServerCrash}
                  className="w-full text-xs p-2 rounded border bg-slate-800 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-300"
                >
                  ! Server Crash
                </button>
                <button
                  onClick={() => setEnvAction(envAction === "place_pizza" ? null : "place_pizza")}
                  className={`w-full text-xs p-2 rounded border transition-all ${
                    envAction === "place_pizza"
                      ? "bg-yellow-900 border-yellow-500 text-yellow-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-yellow-500/50"
                  }`}
                >
                  P Drop Pizza
                </button>
                <button
                  onClick={() => setEnvAction(envAction === "place_energy_drink" ? null : "place_energy_drink")}
                  className={`w-full text-xs p-2 rounded border transition-all ${
                    envAction === "place_energy_drink"
                      ? "bg-blue-900 border-blue-500 text-blue-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-blue-500/50"
                  }`}
                >
                  E Energy Drink
                </button>
              </div>
              {envAction && (
                <div className="mt-2 text-[10px] text-amber-400 text-center">Click a grid cell to place</div>
              )}
            </div>
          )}

          {/* Agent Connection Card */}
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            <h2 className="text-xs font-bold text-slate-200 mb-2">Connect Your Agent</h2>
            <div className="rounded bg-slate-900 border border-slate-700 p-2 mb-2">
              <p className="text-[10px] text-emerald-400 font-mono break-all leading-relaxed">
                {baseUrl ? (
                  <>
                    Read{" "}
                    <a
                      href={`${baseUrl}/skill.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-emerald-300"
                    >
                      {baseUrl}/skill.md
                    </a>
                  </>
                ) : (
                  "Loading..."
                )}
              </p>
            </div>
            <ol className="space-y-1 text-[10px] text-amber-400/90 list-decimal list-inside">
              <li>Send skill.md to your agent</li>
              <li>Agent registers and joins lobby</li>
              <li>Game starts with 3+ agents</li>
            </ol>
          </div>
        </div>
      </aside>

      {/* CENTER: GAME BOARD */}
      <section className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden">
        {/* Game Over Overlay */}
        {selectedGame?.phase === "GAME_OVER" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/95 backdrop-blur-md">
            <div className="text-center px-8">
              <div
                className={`text-5xl md:text-7xl font-black tracking-tighter mb-4 ${
                  selectedGame.outcome === "WIN" ? "text-green-400" : "text-red-400"
                }`}
              >
                {selectedGame.outcome === "WIN" ? "SHIPPED!" : selectedGame.outcome === "TIMEOUT" ? "TIME'S UP" : selectedGame.outcome === "MERGE_CONFLICT" ? "MERGE HELL" : "COFFEE COMA"}
              </div>
              <p className="text-slate-400 text-lg mb-4">
                {selectedGame.outcome === "WIN"
                  ? "Feature complete. The demo was a success!"
                  : selectedGame.outcome === "TIMEOUT"
                  ? "The hackathon ended. The demo crashed."
                  : selectedGame.outcome === "MERGE_CONFLICT"
                  ? "Everyone is stuck resolving conflicts."
                  : "The whole team is at the coffee station."}
              </p>
              <div className="text-slate-500 text-sm">
                {selectedGame.totalCommits} commits | {Math.round(selectedGame.featureProgress)}% complete
              </div>
            </div>
          </div>
        )}

        {selectedGame ? (
          <>
            {/* Header Bar */}
            <div className="h-auto border-b border-slate-800 px-6 py-3 bg-slate-900/50 backdrop-blur-sm z-10">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-200">
                    Game #{selectedGame.id.slice(0, 8)}
                  </h2>
                  <span
                    className={`text-[10px] font-medium ${
                      isCrunchTime ? "text-red-400" : selectedGame.phase === "HACKING" ? "text-green-400" : "text-slate-400"
                    }`}
                  >
                    {selectedGame.phase === "HACKING" ? (isCrunchTime ? "CRUNCH TIME" : "HACKING") : selectedGame.phase}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">
                    Tick {selectedGame.tickCount}/{selectedGame.maxTicks}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedGame.totalCommits}/{selectedGame.targetCommits} commits
                  </div>
                </div>
              </div>

              {/* Deadline Timer */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-slate-500">Deadline</span>
                  <span className={isCrunchTime ? "text-red-400 font-bold animate-countdown-pulse" : "text-slate-400"}>
                    {Math.round(timePercent)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCrunchTime ? "bg-red-500" : timePercent < 30 ? "bg-amber-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${timePercent}%` }}
                  />
                </div>
              </div>

              {/* Feature Progress */}
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-slate-500">Feature Progress</span>
                  <span className="text-green-400 font-bold">{Math.round(selectedGame.featureProgress)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${selectedGame.featureProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
              <div
                className="inline-grid gap-[2px]"
                style={{
                  gridTemplateColumns: `repeat(${selectedGame.grid[0]?.length || 20}, 36px)`,
                  gridTemplateRows: `repeat(${selectedGame.grid.length || 15}, 36px)`,
                }}
              >
                {selectedGame.grid.flatMap((row, rowIdx) =>
                  row.map((cell, colIdx) => {
                    const agent = getAgentAt(colIdx, rowIdx);
                    const isInactive = cell.type === "repo" && !cell.active;
                    const cellColor = isInactive ? "bg-red-950/50 border-red-900/50" : CELL_COLORS[cell.type] || CELL_COLORS.empty;

                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`relative w-9 h-9 border rounded-sm flex items-center justify-center text-[10px] font-mono cursor-pointer transition-all hover:brightness-125 ${cellColor} ${
                          envAction ? "hover:ring-2 hover:ring-amber-400/50" : ""
                        }`}
                        onClick={() => envAction && handleGridClick(colIdx, rowIdx)}
                        title={`(${colIdx},${rowIdx}) ${cell.type}${agent ? ` - ${agent.name}` : ""}`}
                      >
                        {/* Cell Icon */}
                        {cell.type !== "empty" && !agent && (
                          <span className={`text-xs ${isInactive ? "text-red-400 opacity-50" : "text-slate-300"}`}>
                            {CELL_ICONS[cell.type]}
                          </span>
                        )}

                        {/* Agent */}
                        {agent && (
                          <div
                            className={`absolute inset-0.5 rounded-sm border-2 flex items-center justify-center text-[9px] font-bold text-white z-10 ${
                              STATE_COLORS[agent.state] || STATE_COLORS.idle
                            }`}
                            title={`${agent.name} [${agent.state}] ${agent.commits} commits`}
                          >
                            {agent.name.charAt(0)}
                            {agent.hasHeadphones && (
                              <span className="absolute -top-1 -right-1 text-[8px]">H</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Agent Legend */}
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 flex gap-4 text-[10px] text-slate-500 flex-wrap">
              <span>G=Repo</span>
              <span>C=Coffee</span>
              <span>S=Supabase</span>
              <span>M=MongoDB</span>
              <span>P=Pizza</span>
              <span>E=Energy</span>
              <span>H=Headphones</span>
              <span className="text-green-400">Green=Coding</span>
              <span className="text-yellow-400">Yellow=Distracted</span>
              <span className="text-red-400">Red=Panicking</span>
              <span className="text-gray-400">Gray=Conflict</span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
            <div className="text-center">
              <div className="text-5xl mb-4">$</div>
              <div className="text-lg font-medium text-slate-500 mb-2">Waiting for a hackathon...</div>
              <div className="text-sm text-slate-600">Connect agents to start coding</div>
            </div>
          </div>
        )}
      </section>

      {/* RIGHT SIDEBAR */}
      <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
        {selectedGame ? (
          <>
            {/* Event Feed Header */}
            <div className="p-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Events</h3>
            </div>

            {/* Event Feed */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(!selectedGame.events || selectedGame.events.length === 0) && (
                <div className="text-center py-8 text-slate-600 italic text-sm">
                  The hackathon is quiet...
                </div>
              )}

              {selectedGame.events.slice(-50).map((event, i) => {
                const isSystem = event.action === "SYSTEM";
                const isForce = event.action === "force_push";
                const isConflict = event.action === "merge_conflict";
                const isCommit = event.action === "commit";

                if (isSystem) {
                  return (
                    <div key={i} className="flex justify-center my-1">
                      <div className="bg-slate-800/80 text-slate-300 text-[10px] py-1 px-3 rounded-full border border-slate-700">
                        {event.detail}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className="animate-float-up">
                    <div className="flex items-baseline justify-between mb-0.5 px-1">
                      <span
                        className={`text-[10px] font-bold ${
                          isForce ? "text-red-400" : isConflict ? "text-yellow-400" : isCommit ? "text-green-400" : "text-blue-400"
                        }`}
                      >
                        {event.agentName}
                      </span>
                      <span className="text-[9px] text-slate-600 font-mono">t{event.tick}</span>
                    </div>
                    <div
                      className={`p-2 rounded text-xs ${
                        isForce
                          ? "bg-red-950/30 border border-red-900/50 text-red-200"
                          : isConflict
                          ? "bg-yellow-950/30 border border-yellow-900/50 text-yellow-200"
                          : isCommit
                          ? "bg-green-950/30 border border-green-900/50 text-green-200"
                          : "bg-slate-800 border border-slate-700 text-slate-300"
                      }`}
                    >
                      {event.detail}
                    </div>
                  </div>
                );
              })}

              {/* Thinking/coding indicator */}
              {selectedGame.currentActorName && (
                <div className="flex items-center gap-2 p-2 rounded bg-slate-800 border border-blue-500/30 text-slate-300 text-xs">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "200ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "400ms" }} />
                  </span>
                  <span className="font-medium text-blue-200">{selectedGame.currentActorName}</span>
                  <span>is {selectedGame.currentActorState || "thinking"}...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Agent Status Cards */}
            <div className="border-t border-slate-800 p-3">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Dev Team</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedGame.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`p-2 rounded text-xs border ${STATE_COLORS[agent.state] || "border-slate-700 bg-slate-800"}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 truncate">{agent.name}</span>
                      <span
                        className={`text-[9px] uppercase font-bold ${
                          agent.state === "coding" ? "text-green-400" :
                          agent.state === "distracted" ? "text-yellow-400" :
                          agent.state === "panicking" ? "text-red-400" :
                          agent.state === "merge_conflict" ? "text-gray-400" :
                          "text-slate-500"
                        }`}
                      >
                        {agent.state.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[9px] text-slate-500">
                      <span>{agent.commits} commits</span>
                      <span>{agent.forcePushCount} force</span>
                      <span>{agent.coffeeTime}t coffee</span>
                      {agent.hasHeadphones && <span className="text-purple-400">H</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Logs */}
            <div className="h-24 border-t border-slate-800 bg-black p-2 overflow-y-auto font-mono text-[9px] text-slate-500">
              <div className="uppercase font-bold text-slate-600 mb-1 sticky top-0 bg-black">Logs</div>
              {selectedGame.logs.slice(-20).map((log, i) => (
                <div key={i} className="mb-0.5 hover:text-slate-300 transition-colors">
                  {">"} {log}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-slate-600 text-sm">No game selected</div>
        )}
      </aside>
    </main>
  );
}
