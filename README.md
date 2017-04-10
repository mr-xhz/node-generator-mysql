# node-generator-mysql
## 概述
1. 这是一个让你可以远离大部分SQL语句拼接的模块
2. 这是一个支持多个数据源，主从分离的模块

## 版本
v1.0.0 基础功能的支持

    1.增删改查样样都有
    2.支持主从配置
    3.支持多个数据源配置
    4.暂不支持事务

## 安装
先安装吧，骚年。

由于还没有放到npm上面，所以现在只能通过手动去安装，找到本模块的git地址，clone一下，然后在本地执行一下：

`npm install`

安装本模块的mysql依赖。

## 开始使用

### 配置
```javascript
var mysql = require("node-generator-mysql");

mysql.configure({
  //数据源，可以配置多个
  dataSource:[  
    {
      url:"localhost:3306/database,localhost:3306/database",  //有主从的用逗号隔开
      user:"root",  //数据库帐号
      password:"root",  //数据库密码
      prefix:"",  //数据表前缀,如果配置多个数据源的话，那么将通过前缀去决定使用哪个数据源
      model:[]  //这个是prefix的补充 如果这个表的命名不符合那个前缀的话，可以在这个地方直接指明这个表是使用这个数据源
    }
  ],
  logger:{
    error:console.log.bind(console),  //错误日志用什么去打印
    sql:console.log.bind(console)     //SQL语句用什么去打印
  }
});

```
配置完成之后直接连接

```javascript
mysql.connect();
```

也可以

```javascript
mysql.configure(...).connect();
```

OK 配置结束，开始愉快的使用吧

### 我是例子
假设有一张表 user

|字段名|类型|是否主键|
|:----|:--|:--|
|user_id|int(11)|Y|
|user_name|varchar(20)|N|
|status|int(11)|N|

1. 增(会过滤掉不存在的字段,并且返回自增长id)
```javascript
  var userModel = mysql.model("user");
  var user = {
    user_name:"小明",
    status:1,
    no_column:"no_column" //这个字段在插入的时候会被过滤掉
  };
  userModel.insert(user,function(rs){
    console.log(rs.user_id);
  });
  //还可以用promise
  userModel.insert(user).then(function(rs){
    console.log(rs.user_id);
    this.resolve(rs);
  }).then(function(rs){
    console.log(rs);
    this.resolve(rs);
  }).catch(function(e){
    console.error(e);
  }).finally(function(){
    console.log(user.user_id);
  });
  //还可以批量插入
  userModel.insert([{
    user_name:"小明"
  },{
    user_name:"小红"
  }],function(rs){
    rs.forEach(function(item,index){
      console.log(item.user_id);
    });
  });
```
2. 删
```javascript
var userModel = mysql.model("user");
userModel.where("user_id",1).delete(function(row){
  console.log(row === 1);
});
//同上可以使用promise，关于where 的高级用法放最后面去讲
```
3. 改
```javascript
var userModel = mysql.model("user");
userModel.update({
  user_id:1,
  user_name:"小红"
},function(row){
  console.log(row === 1);
});
//同insert 这个可以做批量更新，例子我就不写了
```
4. 查(OK,来到了使用最多的查 所有的方法都可以使用promise)
```javascript
var userModel = mysql.model("user");

//列表查询
userModel.where("status",1).list(function(rs){
  //在这里做一些异步的处理
  this.resolve(rs);
}).then(function(rs){
  console.log(rs);
});
//单个
userModel.where("user_id",1).get(function(rs){
  console.log(rs);
});
//多个限制条件
userModel.orderBy("user_id DESC").groupBy("user_id").limit(0,20).list(function(rs){
  console.log(rs);
});
//获取数量
userModel.count(function(count){
  console.log(count);
});
//获取单个属性列表
userModel.field("user_name").listSingle(function(rs){
  console.log(rs);
});
//获取单个属性
userModel.field("user_name").where("user_id",1).getSingle(function(user_name){
  console.log(user_name);
});
```
5. 接下来就是where条件的大合集了
```javascript
var userModel = mysql.model("user");
//WHERE user_id = 1
userModel.where("user_id",1);
//WHERE user_id > 1
userModel.where("user_id",1,">");
//WHERE user_id IN (1,2)
userModel.where("user_id",[1,2],"in");
//WHERE user_id BETWEEN 1 AND 2
userModel.where("user_id",[1,2],"between");
userModel.where("user_id","1,2","between");
//WHERE user_name LIKE %小%
userModel.where("user_name","%小%","like");
//WHERE user_name IS null
userModel.where("user_name",null,"IS");
//WHERE user_name IS NOT null
userModel.where("user_name",null,"IS NOT");
//WHERE user_id = 1 AND status = 1
userModel.where("user_id",1).where("status",1);
//WHERE user_id = 1 OR status = 1
userModel.where("user_id",1).or("status",1);
userModel.where("user_id",1).where("status",1,"or");
//WHERE (user_id = 1 OR status = 1) AND user_id = 1
var modelWhereList = mysql.modelWhereList();
modelWhereList.where("user_id",1).or("status",1);
userModel.where(modelWhereList).where("user_id",1);
```
