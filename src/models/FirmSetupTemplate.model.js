const mongoose = require('mongoose');

const subcategoryTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  workbasket: { type: String, required: true, trim: true },
}, { _id: false });

const categoryTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  subcategories: { type: [subcategoryTemplateSchema], default: [] },
}, { _id: false });

const workbasketTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['PRIMARY', 'QC'], default: 'PRIMARY' },
}, { _id: false });

const firmSetupTemplateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  template: {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    workbaskets: { type: [workbasketTemplateSchema], default: [] },
    categories: { type: [categoryTemplateSchema], default: [] },
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('FirmSetupTemplate', firmSetupTemplateSchema);
