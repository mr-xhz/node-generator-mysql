var mysql = require("../index");

mysql.configure({
  dataSource:[
    {
      url:"zhangxh.cn:3306/drs,zhangxh.cn:3306/drs",
      user:"root",
      password:"mysql!@#root",
      prefix:"test_",
      model:[
        "user"
      ]
    }
  ],
  logger:{
    error:console.log.bind(console),
    sql:console.log.bind(console)
  }
}).connect();

console.log("connect success");
