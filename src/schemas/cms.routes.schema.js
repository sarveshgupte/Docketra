const Joi = require('joi');

module.exports = {
  createPage: {
    body: Joi.object({
      title: Joi.string().required(),
      content: Joi.string().allow('').optional(),
    }),
  },
  updatePage: {
    body: Joi.object({
      title: Joi.string().optional(),
      content: Joi.string().allow('').optional(),
    }),
  },
}; 
