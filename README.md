![npm version](https://img.shields.io/badge/npm-1.0.0-brightgreen)
 > 仿 Koa 中间件控制的 WebSocket 服务，食用简单，上手容易, 支持 GZIP 解压缩和 ProtoBuffer 解压缩配置，觉得小弟写的还行的话，就给个[Star](https://github.com/mytwz/ssocket)⭐️吧~

## 使用说明

### 运行方式

```javascript
// TS 引入方式 import Ssocket from "ssocket"
const Ssocket = require("ssocket").default;
const server = new Ssocket({ 
    port: 8080,
    redis:{ // 非必传, 用于服务集群做消息同步
        prefix: 'im',
        host: '127.0.0.1',
        port: '6379',
        expire: 60,
    },
});
server.on("start-up", function(){
    console.log("启动成功")
})
```

```javascript
const http = require("http")
const Ssocket = require("ssocket").default;
const httpServer = http.createServer()
const server = new Ssocket({
    server: httpServer,
    verifyClient: ({ origin, secure, req }, callback) => {
        callback(true/**返回 false 的话，连接就会中断并给前端返回 403 的HTTP错误码 */)
    }, // 非必传
    perMessageDeflate: true, // 非必传
    maxPayload: 1024 * 1024 * 10, // 最大传输单位 10M // 非必传
    redis:{ // 非必传, 用于服务集群做消息同步
        prefix: 'im',
        host: '127.0.0.1',
        port: '6379',
        expire: 60,
    },
})

httpServer.listen(8080, function(){
    console.log("启动成功")
})
```

### ProtoBuffer 解压缩配置

```javascript
const server = new Ssocket({
    /**protos 开启压缩并配置：注 当数据量大于 128 字节的时候自动开启 GZIP 压缩  */
    protos:{ // 非必传
        /*request path*/"test":{
            /**
             * [required单字段|repeated重复字段|message自定义结构] [string|uint[8|16|32]|float|double] fieldname: 序号同级唯一
             */
            "required string username": 0,
            "required uint8 age": 1,
            "required uint32 amount": 2,
            "required string avatar": 3,
            "required Data test": 4,
            "message Data": {
                "required string usernmae": 0,
                "repeated List list": 1,
                "message List": {
                    "required uint32 id": 0,
                },
            },
        }
        // {
        //     username:"测试账号",
        //     age:12,
        //     amount: 30000,
        //     avatar:"https://12123123.jpg",
        //     test:{
        //         usernmae: "测试账号2",
        //         ids:[1,3,4,5,6,7,4],
        //         list:[
        //             {id:123},{id:12},{id:23},{id:2123}
        //         ]
        //     }
        // }
    }
})

server.router.ONPath("test", function(ctx, next){
    console.log(ctx.data)// {
    //     username:"测试账号",
    //     age:12,
    //     amount: 30000,
    //     avatar:"https://12123123.jpg",
    //     test:{
    //         usernmae: "测试账号2",
    //         ids:[1,3,4,5,6,7,4],
    //         list:[
    //             {id:123},{id:12},{id:23},{id:2123}
    //         ]
    //     }
    // }
    return {
        username: `登录成功，欢迎${ctx.data.usernmae}`
    }
})

// 前端
client.request("test", {
    username:"测试账号",
    age:12,
    amount: 30000,
    avatar:"https://12123123.jpg",
    test:{
        usernmae: "测试账号2",
        ids:[1,3,4,5,6,7,4],
        list:[
            {id:123},{id:12},{id:23},{id:2123}
        ]
    }
}, function(ctx){
    console.log("返回状态", ctx.status)// 200
    console.log("返回说明", ctx.msg)// ok
    console.log("返回数据", ctx.data) // { username:"登录成功，欢迎测试账号" }
})
```

### 服务端对象事件控制

```javascript
server.on("connection", function(client/**SWebSocket */, request/**IncomingMessage */){
    console.lof("接收到一个客户端连接", client.getid())  
})
server.on("reconnection", function(client/**SWebSocket */, id/**client_id*/){
    console.lof("一个客户端重连成功", client.getid())  
})
server.on("route-error", function(ctx, err){ 
    console.log("路由报错", ctx, err) 
})
server.on("close", function(client_id, code, reason){ 
    console.log("连接关闭", client_id, code, reason) 
})
```

### 路由事件控制

```javascript
const Ssocket = require("ssocket").default;
const { Router, Code, CODE } = require("ssocket");
const server = new Ssocket({ port:8080 })

// 扩展错误码
Code.expandStatusCode(201, "没有提交【username】字段")
// 创建路由对象
const main = new Router();
const user = new Router();
const login = new Router();
// 事件中间件拦截校验请求参数
login.USEMiddleware(function(ctx, next){
    // 校验失败返回错误码
    if(!ctx.data.username) return CODE[201];
    // 校验成功，注：所有的中间件必须拥有返回值，没有返回值就返回 next()
    return next();
})
// 在 /login 路径下注册一个请求处理方法
login.ONPath("/login", function(ctx, next){
    return {
        username: `登录成功，欢迎${ctx.data.usernmae}`
    }
})
// 将登陆路由注册到 /user 路由下
user.USEPathMiddleware("/user", login.routes)
main.USEPathMiddleware("user", user.routes);

// 将 main 路由对象注册到 Socket 服务中
server.router.USEMiddleware(main.routes);

// 前端
client.request("user/user/login"/*由上面路由对象会组成这个路由路径*/, { username:"小明" }, function(ctx){
    console.log("返回状态", ctx.status)// 200/201
    console.log("返回说明", ctx.msg)// ok/没有提交【username】字段
    console.log("返回数据", ctx.data) // { username:"登录成功，欢迎小明" }
})
```

### 消息控制

```javascript
login.ONPath("/login", async function(ctx, next){

    ctx.socket // 在上下文中会注入 SWebSocket 对象
    ctx.application // 在上下文中会注入 Application 对象，这个对象等于上面的 Ssocket
    // 加入房间
    ctx.application.join(ctx.socket_id, "roomid_123")
    //离开房间
    ctx.application.leave(ctx.socket_id, "roomid_123")

    // 获取所有的房间ID
    let rooms = await ctx.application.getRoomall()
    // 根据 客户端ID 获取所在的所有房间ID
    let rooms = await ctx.application.getRoomidByid(ctx.socket_id)
    // 根据房间号获取所有的客户端ID
    let clientids = await ctx.application.getClientidByroom("roomid_123")
    // 获取所有的房间总数
    let room_count = await ctx.application.getAllRoomcount()
    // 获取房间内人员数量
    let client_count = await ctx.application.getRoomsize("roomid_123")
    // 判断客户端是否存在啊某个房间
    let flog = await ctx.application.hasRoom(ctx.socket_id, "roomid_123")

    // 单独向某条连接发送消息
    ctx.application.sendSocketMessage(ctx.socket_id, "user.user.login", { username:`登录成功，欢迎${ctx.data.usernmae}` })
    // 单独向某个房间发送消息
    ctx.application.sendRoomMessage("roomid_123", "user.user.login", { username:`登录成功，欢迎${ctx.data.usernmae}` })
    // 向所有连接发送广播消息
    ctx.application.sendBroadcast("user.user.login", { username:`登录成功，欢迎${ctx.data.usernmae}` })

    return {
        username: `登录成功，欢迎${ctx.data.usernmae}`
    }
})


// 前端
client.on("user.user.login", function(ctx){
    console.log("返回状态", ctx.status)// 200
    console.log("返回说明", ctx.msg)// ok
    console.log("返回数据", ctx.data) // { username:"登录成功，欢迎小明" }
})

```

### 客户端对象事件控制

```javascript
server.on("connection", function(client/**SWebSocket */, request/**IncomingMessage */){
    console.log("接收到一个客户端连接", client.getid())

    client.on("close", function(id, code, reason){
        console.log("连接断开, 客户端ID", id)
        console.log("断开代码", code)
        console.log("断开原因", reason)
    })
    client.on("shakehands", function(status){
        console.log("握手状态", status)// 2握手成功|3握手完毕
    })
    client.on("connection", function(id){
        console.log("握手完毕，连接成功, 客户端ID", id)
    })
    client.on("reconnection", function(id){
        console.log("重新连接成功, 客户端ID", id)
    })
    client.on("ping", function(client_now_time){
        console.log("收到客户端一个心跳事件, 此时该客户端当前时间是", client_now_time)
    })
    client.on("pong", function(){
        console.log("服务器回复一个心跳响应事件")
    })

})
```

