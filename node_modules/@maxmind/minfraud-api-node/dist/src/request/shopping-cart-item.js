"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
class ShoppingCartItem {
    constructor(item) {
        if (item.quantity != null &&
            (!Number.isInteger(item.quantity) || item.quantity < 0)) {
            throw new errors_1.ArgumentError(`Expected a positive integer for quantity but received: ${item.quantity}`);
        }
        Object.assign(this, item);
    }
}
exports.default = ShoppingCartItem;
