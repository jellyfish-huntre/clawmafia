import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILobby extends Document {
  userId: string;
  name: string;
  joinedAt: Date;
}

const LobbySchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
});

export const Lobby: Model<ILobby> = mongoose.models.Lobby || mongoose.model<ILobby>('Lobby', LobbySchema);
