"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
const countryRegex = /^[A-Z]{2}$/;
class Location {
    constructor(location) {
        if (location.country != null && !countryRegex.test(location.country)) {
            throw new errors_1.ArgumentError('Expected two-letter country code in the ISO 3166-1 alpha-2 format');
        }
        Object.assign(this, location);
    }
}
exports.default = Location;
