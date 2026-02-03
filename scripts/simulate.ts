import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';

// Load env vars immediately
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing.');
  process.exit(1);
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Agent Definitions
const AGENTS = [
  {
    name: "Ramesh Raskar",
    username: "ramesh",
    context: `Ramesh Raskar is an Associate Professor at the MIT Media Lab... (Expert in imaging, health tech, startups)`,
  },
  {
    name: "Pradyumna Chari",
    username: "pradyumna",
    context: `Postdoctoral Associate at MIT Media Lab... (Focus on computer vision, decentralized AI, physics+AI)`,
  },
  {
    name: "Maria Gorskikh",
    username: "mariagorskikh",
    context: `Founder of NANDA and AIA. Building tools for AI agents, communication protocols, and infrastructure...`,
  },
  {
    name: "Aryaman Shrivastava",
    username: "aryshriv",
    context: `Student at BU, 21 years old.`,
  }
];

// Map to store API Keys
const agentKeys: Record<string, string> = {};

async function getAgentAction(agentName: string, state: any): Promise<{ action: string, targetId?: string, reason?: string }> {
    if (!openai) {
        return randomAction(state);
    }
    
    const agent = AGENTS.find(a => a.name === agentName);
    const context = agent?.context || "A generic mafia player.";
    
    const myPlayer = state.players.find((p: any) => p.name === agentName);
    if (!myPlayer || !myPlayer.isAlive) return { action: 'none' };
    
    const role = myPlayer.role || 'UNKNOWN';
    
    const prompt = `
    You are playing a game of Mafia (Werewolf).
    Your Name: ${agentName}
    Your Persona: ${context}
    
    Current Game State:
    Phase: ${state.phase}
    Day: ${state.dayCount}
    Your Role: ${role}
    Alive Players: ${state.players.filter((p: any) => p.isAlive).map((p: any) => p.name).join(', ')}
    Logs: 
    ${state.logs.slice(-5).join('\n')}
    
    Task: Decide on your next action.
    
    Rules:
    - If Phase is DAY: You must VOTE for someone to eliminate.
    - If Phase is NIGHT:
      - If MAFIA: Choose someone to KILL.
      - If DOCTOR: Choose someone to HEAL.
      - If DETECTIVE: Choose someone to INVESTIGATE.
      - If VILLAGER: Do nothing.
    
    Available Targets (IDs):
    ${state.players.filter((p: any) => p.id !== myPlayer.id && p.isAlive).map((p: any) => `${p.name} (ID: ${p.id})`).join('\n')}
    
    Return JSON:
    {
      "action": "vote" | "kill" | "heal" | "check" | "wait",
      "targetId": "id_of_target",
      "reason": "short explanation"
    }
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content || '{}');
        return result;
    } catch (e) {
        console.error("OpenAI Error", e);
        return randomAction(state);
    }
}

function randomAction(state: any) {
    return { action: 'wait' };
}

async function main() {
    // Dynamic import to handle env var loading order
    const { GameService } = await import('../src/lib/gameService');
    const { default: dbConnect } = await import('../src/lib/db');
    
    const gameService = new GameService();
    
    await dbConnect();
    console.log('📝 Registering agents...');
    
    const User = mongoose.model('User'); 
    
    for (const agent of AGENTS) {
        let user = await User.findOne({ name: agent.name });
        
        if (!user) {
            console.log(`Creating new user: ${agent.name}`);
            user = await gameService.registerUser(agent.name);
        } else {
            console.log(`Found existing user: ${agent.name}`);
        }
        
        agentKeys[agent.name] = user.apiKey;
    }
    
    console.log('🔄 Starting game loop...');
    
    while (true) {
        let activeGames = new Set<string>();
        
        for (const agent of AGENTS) {
            const apiKey = agentKeys[agent.name];
            if (!apiKey) continue;
            
            const status = await gameService.getGameStatus(apiKey);
            
            if (!status) {
                console.log(`${agent.name}: Joining lobby...`);
                await gameService.joinLobby(apiKey);
                continue;
            }
            
            if (status.phase === 'LOBBY') {
                continue;
            }
            
            if (status.phase === 'GAME_OVER') {
                console.log(`${agent.name}: Game Over! Winner: ${status.winner}`);
                await gameService.joinLobby(apiKey);
                continue;
            }
            
            activeGames.add(status.id);
            
            const gameDoc = await mongoose.model('Game').findById(status.id);
            if (!gameDoc) continue;
            
            const myRealPlayer = gameDoc.players.find((p: any) => p.id === apiKey);
            if (!myRealPlayer) continue;
            
            const role = myRealPlayer.role;
            
            const augmentedStatus = { ...status, players: status.players.map(p => {
                if (p.id === apiKey) return { ...p, role };
                return p;
            })};

            // Only act if alive
            if (!myRealPlayer.isAlive) {
                 // Dead players don't act
                 continue;
            }

            console.log(`${agent.name} (${role}): Thinking...`);
            const decision = await getAgentAction(agent.name, augmentedStatus);
            
            if (decision.action !== 'wait' && decision.action !== 'none') {
                console.log(`${agent.name} performs ${decision.action} on ${decision.targetId} (${decision.reason})`);
                try {
                    await gameService.performAction(apiKey, decision.action, decision.targetId, decision.reason);
                } catch (e: any) {
                    console.error(`Action failed: ${e.message}`);
                }
            }
        }
        
        // Wait 5 seconds
        await new Promise(r => setTimeout(r, 5000));
        
        // Advance games
        const games = await gameService.getAllGames();
        for (const g of games) {
            if (g.phase !== 'GAME_OVER') {
                 await gameService.advanceGame(g._id.toString());
            }
        }
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
