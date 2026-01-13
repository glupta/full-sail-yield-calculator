// EventEmitter shim for browser compatibility
// Fixes: ee__default.default.create is not a function
import EventEmitter from 'events';

// Add .create() method if missing (Node.js EventEmitter has this, browser polyfills may not)
if (typeof EventEmitter.create !== 'function') {
    EventEmitter.create = function () {
        return new EventEmitter();
    };
}

// Also handle default export case
if (EventEmitter.default && typeof EventEmitter.default.create !== 'function') {
    EventEmitter.default.create = function () {
        return new EventEmitter();
    };
}

export default EventEmitter;
