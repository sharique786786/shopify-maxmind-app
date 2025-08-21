"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Event {
    constructor(minfraudEvent) {
        Object.assign(this, minfraudEvent);
        if (!this.time) {
            this.time = new Date(Date.now());
        }
    }
}
exports.default = Event;
