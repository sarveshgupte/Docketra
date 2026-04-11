const EventEmitter = require('events');

class EventBus extends EventEmitter {}

const eventBus = new EventBus();

eventBus.setMaxListeners(50);

module.exports = { eventBus };
