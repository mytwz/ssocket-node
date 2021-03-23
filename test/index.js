/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-03-23 17:06:12 +0800
 * @LastEditTime: 2021-03-23 17:08:26 +0800
 * @FilePath: /ssocket/test/index.js
 */

const Ssocket = require("../").default;
const server = new Ssocket({ 
    port: 8080
});
server.on("start-up", function(){
    console.log("启动成功")
})