import mongoose, { Schema, Document, Model } from 'mongoose';
import { Phase, Role } from '@/lib/game';

// Helper sub-schemas
const PlayerSchema = new Schema({
  id: { type: String, required: true }, // User ID / API Key or generic ID
  name: { type: String, required: true },
  role: { type: String }, // Role enum
  isAlive: { type: Boolean, default: true },
});

export interface IGame extends Document {
  phase: Phase;
  players: any[]; // Using any[] for simplicity in TS interface, but defined in schema
  dayCount: number;
  winner: string | null;
  logs: string[];
  actions: any[];
  
  // Private state
  mafiaTarget: string | null;
  doctorTarget: string | null;
  detectiveTarget: string | null;
  votes: Record<string, string>; // Map of voterId -> targetId
  
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema: Schema = new Schema({
  phase: { type: String, default: 'LOBBY' },
  players: [PlayerSchema],
  dayCount: { type: Number, default: 0 },
  winner: { type: String, default: null },
  logs: [{ type: String }],
  actions: [{ type: Schema.Types.Mixed }], // Flexible schema for action logs
  
  // Private state persisted
  mafiaTarget: { type: String, default: null },
  doctorTarget: { type: String, default: null },
  detectiveTarget: { type: String, default: null },
  votes: { type: Map, of: String, default: {} },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update timestamp on save
GameSchema.pre('save', function() {
  this.updatedAt = new Date();
});

export const Game: Model<IGame> = mongoose.models.Game || mongoose.model<IGame>('Game', GameSchema);
