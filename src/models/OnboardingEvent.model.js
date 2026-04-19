const mongoose = require('mongoose');

const EVENT_NAMES = [
  'welcome_tutorial_shown',
  'welcome_tutorial_completed',
  'welcome_tutorial_skipped',
  'product_tour_started',
  'product_tour_completed',
  'onboarding_progress_refreshed',
  'onboarding_step_completed_detected',
  'onboarding_step_completed_manual',
  'onboarding_step_cta_opened',
  'onboarding_checklist_dismissed',
];

const onboardingEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userXID: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
  },
  role: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  eventName: {
    type: String,
    enum: EVENT_NAMES,
    required: true,
    index: true,
  },
  stepId: {
    type: String,
    default: null,
    trim: true,
  },
  source: {
    type: String,
    enum: ['detected', 'manual'],
    default: null,
  },
  metadata: {
    type: Object,
    default: undefined,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
}, {
  timestamps: false,
  collection: 'onboarding_events',
  strict: true,
});

onboardingEventSchema.index({ firmId: 1, createdAt: -1 });
onboardingEventSchema.index({ eventName: 1, createdAt: -1 });
onboardingEventSchema.index({ firmId: 1, role: 1, eventName: 1, createdAt: -1 });

module.exports = {
  OnboardingEvent: mongoose.model('OnboardingEvent', onboardingEventSchema),
  ONBOARDING_EVENT_NAMES: EVENT_NAMES,
};
