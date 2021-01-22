/// <reference types="node" />
import WebSocket from "ws";
import { EventEmitter } from 'events';
import * as Code from "./code";
export interface Options {
    ping_timeout: number;
}
export declare class SWebSocket extends EventEmitter {
    private socket;
    [key: string]: any;
    private id;
    private opts;
    private ping_timeout_id;
    private status;
    getid(): string;
    getSocket(): WebSocket;
    getStatus(): Code.SocketStatus;
    constructor(socket: WebSocket, opts?: Options);
    private onclose;
    private message;
    private setPingtimeout;
    private shakehands;
    private send;
    response(path: string, status: number, msg: string, request_id: number, data: any): Promise<void>;
}
