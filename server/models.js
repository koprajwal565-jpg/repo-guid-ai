import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  passwordHash: { type: String, required: true, select: false },
  profile: {
    experience: { type: String, default: 'beginner', enum: ['beginner', 'intermediate', 'advanced'] },
    languages: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    weeklyHours: { type: Number, default: 3, min: 1, max: 80 },
  },
}, { timestamps: true })

const savedRepositorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  fullName: { type: String, required: true },
}, { timestamps: true })
savedRepositorySchema.index({ user: 1, owner: 1, repo: 1 }, { unique: true })

const progressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  steps: [{ id: String, title: String, done: { type: Boolean, default: false } }],
}, { timestamps: true })
progressSchema.index({ user: 1, owner: 1, repo: 1 }, { unique: true })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
export const SavedRepository = mongoose.models.SavedRepository || mongoose.model('SavedRepository', savedRepositorySchema)
export const UserProgress = mongoose.models.UserProgress || mongoose.model('UserProgress', progressSchema)
