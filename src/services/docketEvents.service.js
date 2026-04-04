const EventEmitter = require('events');

class DocketEvents extends EventEmitter {}

const docketEvents = new DocketEvents();

const EVENT_NAMES = Object.freeze({
  ASSIGNMENT: 'docket.assignment',
  QC_REQUEST: 'docket.qc_request',
  QC_FAILURE: 'docket.qc_failure',
  PENDING_REOPEN: 'docket.pending_reopen',
});

function emitDocketEvent(eventName, payload) {
  docketEvents.emit(eventName, {
    ...payload,
    emittedAt: new Date(),
  });
}

module.exports = {
  docketEvents,
  EVENT_NAMES,
  emitDocketEvent,
};
