'use client';

import { useEffect, useState, useRef } from 'react';

type Player = {
  id: string;
  name: string;
  role: string | null;
  isAlive: boolean;
};

type GameState = {
  id: string;
  phase: string;
  players: Player[];
  dayCount: number;
  winner: string | null;
  logs: string[];
  actions?: {
    playerId: string;
    playerName: string;
    action: string;
    targetId?: string;
    reason?: string;
    phase: string;
    day: number;
    timestamp: string;
  }[];
};

export default function Home() {
  const [games, setGames] = useState<GameState[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [lobbyCount, setLobbyCount] = useState<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchSystemState = async () => {
    try {
      const res = await fetch('/api/debug/state');
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [games]);

  const resetSystem = async () => {
    await fetch('/api/game/reset', { method: 'POST' });
    fetchSystemState();
    setSelectedGameId(null);
  };

  const advanceAll = async () => {
    await fetch('/api/game/advance', { method: 'POST' });
    fetchSystemState();
  };

  const addBot = async () => {
    const name = `Bot_${Math.floor(Math.random() * 1000)}`;
    const regRes = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const regData = await regRes.json();
    
    if (regData.apiKey) {
      await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'x-api-key': regData.apiKey }
      });
    }
    fetchSystemState();
  };

  const selectedGame = games.find(g => g.id === selectedGameId) || games[0];

  useEffect(() => {
    if (!selectedGameId && games.length > 0) {
        setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId]);

  return (
    <main className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex overflow-hidden">
      {/* LEFT SIDEBAR: CONTROLS & GAMES LIST */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-xl font-bold text-slate-100 tracking-wider">MAFIA MMO</h1>
          <div className="text-xs text-slate-500 mt-1">Admin Dashboard</div>
        </div>

        <div className="p-4 space-y-2 border-b border-slate-800">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Global Controls</div>
            <button onClick={addBot} className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-sm font-medium transition-colors">
              + Add Bot
            </button>
            <button onClick={advanceAll} className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors">
              Advance Phase
            </button>
            <button onClick={resetSystem} className="w-full py-2 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 rounded text-sm font-medium transition-colors">
              Reset System
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Lobby ({lobbyCount})</h2>
            <div className="bg-slate-800/50 rounded p-3 text-center border border-slate-800 border-dashed">
                <span className="text-2xl font-mono text-slate-400">{lobbyCount}</span>
                <div className="text-[10px] text-slate-600">Waiting for players</div>
            </div>
          </div>

          <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Active Games ({games.length})</h2>
          <div className="space-y-2">
            {games.map(game => (
              <div 
                key={game.id}
                onClick={() => setSelectedGameId(game.id)}
                className={`p-3 rounded cursor-pointer transition-all border ${selectedGameId === game.id ? 'bg-blue-900/30 border-blue-600/50 shadow-lg shadow-blue-900/20' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-300 truncate w-20">#{game.id.slice(-4)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    game.phase === 'GAME_OVER' ? 'bg-slate-700 text-slate-400' : 
                    game.phase === 'NIGHT' ? 'bg-indigo-900 text-indigo-300' :
                    'bg-amber-900/50 text-amber-300'
                  }`}>
                    {game.phase}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>Day {game.dayCount}</span>
                  <span>{game.players.length} Players</span>
                </div>
              </div>
            ))}
            {games.length === 0 && <div className="text-slate-600 text-sm italic text-center py-4">No active games</div>}
          </div>
        </div>
      </aside>

      {/* CENTER: GAME BOARD */}
      <section className="flex-1 bg-slate-950 flex flex-col relative">
        {selectedGame ? (
            <>
                {/* Game Header */}
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm z-10">
                    <div>
                        <h2 className="text-lg font-bold text-slate-200">Game #{selectedGame.id.slice(0,8)}...</h2>
                        <div className="flex gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${selectedGame.phase === 'DAY' ? 'bg-amber-400' : selectedGame.phase === 'NIGHT' ? 'bg-indigo-500' : 'bg-slate-500'}`}></span>
                                {selectedGame.phase} {selectedGame.dayCount}
                            </span>
                            {selectedGame.winner && <span className="text-emerald-400 font-bold">Winner: {selectedGame.winner}</span>}
                        </div>
                    </div>
                </div>

                {/* Players Grid */}
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                        {selectedGame.players.map(p => (
                            <div key={p.id} className={`relative group p-4 rounded-xl border-2 transition-all duration-300 ${
                                !p.isAlive 
                                    ? 'bg-slate-900/50 border-slate-800 opacity-60 grayscale' 
                                    : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:shadow-xl hover:-translate-y-1'
                            }`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                                        !p.isAlive ? 'bg-slate-800 text-slate-600' : 'bg-linear-to-br from-blue-600 to-indigo-700 text-white shadow-lg'
                                    }`}>
                                        {p.name.charAt(0)}
                                    </div>
                                    {!p.isAlive && (
                                        <span className="bg-red-900/80 text-red-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                            Dead
                                        </span>
                                    )}
                                </div>
                                
                                <div className="font-bold text-slate-200 truncate mb-1" title={p.name}>{p.name}</div>
                                <div className="text-[10px] font-mono text-slate-500 truncate mb-2">{p.id}</div>
                                
                                {p.role ? (
                                    <div className={`text-xs font-bold uppercase tracking-wider py-1 px-2 rounded text-center ${
                                        p.role === 'MAFIA' ? 'bg-red-950 text-red-400 border border-red-900' :
                                        p.role === 'DOCTOR' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                                        p.role === 'DETECTIVE' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                                        'bg-slate-700 text-slate-300'
                                    }`}>
                                        {p.role}
                                    </div>
                                ) : (
                                    <div className="text-xs font-bold uppercase tracking-wider py-1 px-2 rounded text-center bg-slate-900 text-slate-600 border border-slate-800">
                                        Unknown
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600">
                <div className="text-center">
                    <div className="text-4xl mb-2">🎲</div>
                    <div>Select a game to spectate</div>
                </div>
            </div>
        )}
      </section>

      {/* RIGHT SIDEBAR: CHAT & LOGS */}
      <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
        {selectedGame ? (
            <>
                <div className="p-4 border-b border-slate-800 bg-slate-900">
                    <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Game Events</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
                    {/* Combine Logs and Actions into a single feed? For now let's just show actions as chat and logs as system messages if we can interleave them. 
                        Since we don't have timestamps on logs easily, let's just show the Action Chat as the main feature. */}
                    
                    {(!selectedGame.actions || selectedGame.actions.length === 0) && (
                        <div className="text-center py-10 text-slate-600 italic text-sm">
                            The town is quiet...
                        </div>
                    )}

                    {selectedGame.actions?.map((action, i) => {
                         const targetName = action.targetId ? selectedGame.players.find(p => p.id === action.targetId)?.name || action.targetId : null;
                         const isMafia = action.action === 'kill';
                         const isSystem = action.action === 'SYSTEM';

                         if (isSystem) {
                             return (
                                <div key={i} className="flex justify-center my-4 animate-in fade-in zoom-in duration-500">
                                    <div className="bg-slate-800/80 text-slate-300 text-xs py-1 px-4 rounded-full border border-slate-700 shadow-sm backdrop-blur-sm">
                                        {action.reason}
                                    </div>
                                </div>
                             );
                         }
                         
                         return (
                            <div key={i} className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-baseline justify-between mb-1 px-1">
                                    <span className={`text-xs font-bold ${isMafia ? 'text-red-400' : 'text-blue-400'}`}>
                                        {action.playerName}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono">
                                        Day {action.day}
                                    </span>
                                </div>
                                
                                <div className={`p-3 rounded-lg rounded-tl-none text-sm relative ${
                                    isMafia ? 'bg-red-950/30 border border-red-900/50 text-red-100' : 'bg-slate-800 border border-slate-700 text-slate-200'
                                }`}>
                                    <div className="mb-1 text-[10px] uppercase font-bold opacity-70 flex items-center gap-1">
                                        {action.action} {targetName && <span>➝ {targetName}</span>}
                                    </div>
                                    <div className="leading-relaxed opacity-90">
                                        "{action.reason}"
                                    </div>
                                </div>
                            </div>
                         );
                    })}
                    <div ref={chatEndRef} />
                </div>

                {/* System Log Drawer (Collapsible or small at bottom) */}
                <div className="h-32 border-t border-slate-800 bg-black p-2 overflow-y-auto font-mono text-[10px] text-slate-500">
                    <div className="uppercase font-bold text-slate-600 mb-1 sticky top-0 bg-black">System Logs</div>
                    {selectedGame.logs.map((log, i) => (
                        <div key={i} className="mb-0.5 hover:text-slate-300 transition-colors">
                            {'>'} {log}
                        </div>
                    ))}
                </div>
            </>
        ) : (
            <div className="p-8 text-center text-slate-600 text-sm">
                No game selected
            </div>
        )}
      </aside>
    </main>
  );
}
