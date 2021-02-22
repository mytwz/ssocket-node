import WebSocket from "ws";
import * as utils from "./utils"
import { EventEmitter } from 'events';
import CODE, * as Code from "./code"
import debug from "./logger";

const logger = debug("swebsocket")

export interface Options {
    ping_timeout: number;
}

export class SWebSocket extends EventEmitter {

    [key: string]: any;
    private id: string;
    private opts: Options;
    private ping_timeout_id: NodeJS.Timeout;
    private status: Code.SocketStatus = Code.SocketStatus.OPEN;
    public getid(): string { return this.id; }
    public getSocket(): WebSocket { return this.socket; }
    public getStatus(): Code.SocketStatus { return this.status }

    constructor(private socket: WebSocket, opts?: Options) {
        super()
        this.opts = Object.assign({
            ping_timeout: 1000 * 60
        }, opts)
        this.ping_timeout_id = <NodeJS.Timeout><unknown>0;
        this.id = utils.id24();
        this.socket.on("close", (code: number, reason: string) => this.onclose(code, reason));
        this.socket.on("error", err => this.emit("error", err));
        this.socket.on("upgrade", request => this.emit("upgrade", request));
        this.socket.on("unexpected-response", (request, response) => this.emit("unexpected-response", request, response));
        this.socket.on("message", this.message.bind(this));
        logger(this.id + ":constructor", {opts})
        this.setPingtimeout();
    }

    private onclose(code: number, reason: string){
        clearTimeout(this.ping_timeout_id);
        if(this.status == Code.SocketStatus.CLOSE) return;
        if(this.socket.readyState != WebSocket.CLOSED) return this.socket.close(code, reason)
        this.status = Code.SocketStatus.CLOSE
        this.socket.removeAllListeners();
        this.socket = <WebSocket><unknown>null;
        this.emit("close", this.getid(), code, reason)
        this.removeAllListeners();
        logger(this.id + ":close", {code, reason})
    }

    private message(buffer: Buffer) {
        let data: any = Code.decode(buffer);
        logger(this.id + ":message", data)
        if(data.type == Code.PackageType.shakehands) {
            if(data.ack == Code.SocketStatus.SHAKING_HANDS){
                this.shakehands(Code.SocketStatus.HANDSHAKE);
                this.emit("shakehands", this.status = Code.SocketStatus.HANDSHAKE)
            }
            else if(data.ack == Code.SocketStatus.CONNECTION){
                this.shakehands(Code.SocketStatus.CONNECTION);
                this.emit("shakehands", this.status = Code.SocketStatus.CONNECTION)
                this.emit(this.id != data.id ? "reconnection" : "connection", this.id = data.id)
            }
        }
        else if(data.type == Code.PackageType.heartbeat) {
            this.emit("ping", data.data)
            this.socket.send(Code.encode(Code.PackageType.heartbeat))
            this.setPingtimeout();
            this.emit("pong")
        }
        else if(data.type == Code.PackageType.data) {
            this.emit("message", data);
        }
    }

    private setPingtimeout(){ 
        clearTimeout(this.ping_timeout_id);
        this.ping_timeout_id = setTimeout(() => this.onclose(<number>CODE[4100][0], <string>CODE[4100][1] ), this.opts.ping_timeout) 
    }

    private shakehands(ack: Code.SocketStatus){
        this.send({ id: this.getid(), ack}, Code.PackageType.shakehands)
    }

    private async send(data: Code.PackageData | Code.ShakehandsPackageData, type: Code.PackageType = Code.PackageType.data) {
        if(type == Code.PackageType.data && !(<Code.PackageData>data).path) throw new Error("Cannot have the path field")
        this.socket.send(Code.encode(type, data))
        logger(this.id + ":send", data)
    }

    public async response(path: string, status: number, msg: string, request_id:number, data: any){
        return this.send({ path, status, msg, request_id, data })
    }
}



