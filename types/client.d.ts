/// <reference types="node" />
import WebSocket from "ws";
import { EventEmitter } from 'events';
import * as Code from "./code";
import { IncomingMessage } from "http";
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
    browser: string;
    device: string;
    os: string;
    getid(): string;
    getSocket(): WebSocket;
    getStatus(): Code.SocketStatus;
    constructor(socket: WebSocket, req: IncomingMessage);
    private onclose;
    private message;
    private setPingtimeout;
    private shakehands;
    private send;
    response(path: string, status: number, msg: string, request_id: number, data: any): Promise<void>;
}
