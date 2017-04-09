var mysql = require("../index");

mysql.configure({
  dataSource:[
    {
      url:"localhost:3306/drs,localhost:3306/drs",
      user:"root",
      password:"root",
      prefix:"",
      model:[]
    }
  ],
  logger:{
    error:console.log.bind(console),
    sql:console.log.bind(console)
  }
}).connect();

console.log("connect success");
