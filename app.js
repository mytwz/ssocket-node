/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @LastEditTime: 2021-01-22 12:26:22 +0800
 * @FilePath: \ssocket\app.js
 */
const Ssocket = require("./dist/index").default;

const server = new Ssocket({
    port: 8080,
    protos:{
        test:{
            "required string username": 0
        }
    },
    logger: /*true|"ssocket*"*/function(n, args){
        console.log(n, args)
    }
})

server.router.ONPath("test", function(ctx, next){
    console.log("收到前端数据", ctx.data)
    return {
        username:"你好" + ctx.data.username
    }
})

server.on("start-up", function(){ console.log("启动成功") })

