/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @LastEditTime: 2021-01-22 14:50:46 +0800
 * @FilePath: \ssocket\src\logger.ts
 */



import debug from "debug";

function date_format() {
    var time = new Date();
    return `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()} ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} ${time.getMilliseconds()}`
}

export default function (name: string) {
    return function (n: string, ...args: any) {
        if(debug.prototype.logger instanceof Function){
            return debug.prototype.logger(n, JSON.stringify(args));
        }
        else if(debug.prototype.logger instanceof String){
            debug.enable(debug.prototype.logger)
        }
        else if(debug.prototype.logger){
            debug.enable("*")
        }
        debug("ssocket:" + name).extend(n)("[%s]: %s", date_format(), JSON.stringify(args));
    }
}

