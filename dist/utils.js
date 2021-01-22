"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.id24 = void 0;
var __index__ = 0;
var id24_buffer = Buffer.alloc(16);
/**
 * 获取一个 24 位的ID
 * - 进程ID + 时间戳后 6 位 + 6 位序列号 + 随机数后 6 位
 * - 经测试 100W 次运行中，没有发现重复ID
 */
function id24() {
    var offset = 0;
    id24_buffer.writeUInt32BE(+process.pid, offset);
    offset += 4;
    id24_buffer.writeUInt32BE(+String(Date.now()).substr(-6), offset);
    offset += 4;
    id24_buffer.writeUInt32BE((++__index__ > 999999) ? (__index__ = 1) : __index__, offset);
    offset += 4;
    id24_buffer.writeUInt32BE(+String(Math.random()).substr(-6), offset);
    offset += 4;
    return id24_buffer.toString("base64");
}
exports.id24 = id24;
