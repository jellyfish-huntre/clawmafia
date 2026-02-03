import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  apiKey: string;
  name: string;
  createdAt: Date;
  currentGameId?: string;
}

const UserSchema: Schema = new Schema({
  apiKey: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  currentGameId: { type: String }, // ID of the game they are currently in
  createdAt: { type: Date, default: Date.now },
});

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
