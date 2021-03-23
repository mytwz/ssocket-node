"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description:
 * @LastEditTime: 2021-01-22 14:50:46 +0800
 * @FilePath: \ssocket\src\logger.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
function date_format() {
    var time = new Date();
    return `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()} ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} ${time.getMilliseconds()}`;
}
function default_1(name) {
    return function (n, ...args) {
        if (debug_1.default.prototype.logger instanceof Function) {
            return debug_1.default.prototype.logger(n, JSON.stringify(args));
        }
        else if (debug_1.default.prototype.logger instanceof String) {
            debug_1.default.enable(debug_1.default.prototype.logger);
        }
        else if (debug_1.default.prototype.logger) {
            debug_1.default.enable("*");
        }
        debug_1.default("ssocket:" + name).extend(n)("[%s]: %s", date_format(), JSON.stringify(args));
    };
}
exports.default = default_1;
