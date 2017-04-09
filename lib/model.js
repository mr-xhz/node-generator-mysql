var Promise = require("./util/promise"),
    ModelSQL = require("./obj/model-sql"),
    $ = require("./util/util");

function Model(table,source,logger){
  this._table = table;
  this._source = source;
  this._logger = logger;
  this._bReady = false;

  this._fieldInfo = {};
  this._priKey = "";

  this._modelSQL = new ModelSQL(table,logger);

  this._readyCallback = [];
  this._init();
}

module.exports = Model;

Model.prototype = {
  _error:function(){
    var self = this;
    var logger = self._logger;
    logger.error && logger.error.apply(logger,arguments);
  },
  _sql:function(){
    var self = this;
    var logger = self._logger;
    logger.sql && logger.sql.apply(logger,arguments);
  },
  _trycatch:function(callback){
    var self = this;
    return function(err){
      if(err){
        self._error(err);
        return callback(null);
      }
      var args = Array.prototype.slice.call(arguments,1);
      callback.apply(null,args);
    }
  },
  _init:function(){
    var self = this;

    var sql = "SHOW FULL FIELDS FROM `"+self._table+"`";
    self._sql(sql);
    self._source.master.query(sql,self._trycatch(function(rs){
      for (var i = 0; i < rs.length; i++) {
        var obj = rs[i];
        self._fieldInfo[obj.Field] = obj;
        if(obj.Key == "PRI"){
          self._priKey = obj.Field;
        }
      }
      self._bReady = true;
      self._onReady();
    }));
    return self;
  },
  _createNewModelSQL:function(){
    var self = this;
    var modelSQL = self._modelSQL;
    self._modelSQL = new ModelSQL(self._table,self._logger);
    return modelSQL;
  },
  _onReady:function(){
    var self = this;
    $.each(self._readyCallback,function(){
      this.call(self);
    });
  },
  _ready:function(callback){
    var self = this;
    if(self._isReady){
      return callback.call(self);
    }
    self._readyCallback.push(callback);
  },
  //////////////////////////////////////////////////////////////////////////
  query:function(sql,callback){
    var self = this;
    var conn = self._source.master;
    if(/^select\s/i.test(sql)){
      //查询语句走从库
      conn = self._source.slave;
    }
    return new Promise(function(){
      var promise = this;
      conn.query(sql,self._trycatch(function(){
        if(callback) {
          callback.apply(promise, arguments);
        }else{
          promise.resolve(arguments[0]);
        }
      }));
    });
  },
  update:function(){
    var self = this;
    if(arguments.length == 0){
      return self;
    }
    var args = Array.prototype.slice.call(arguments);

    //走主库
    var conn = self._source.master;

    var modelSQL = self._createNewModelSQL();

    //返回一个promise对象 后面可以用链式
    return new Promise(function(){
      var THIS = this;
      self._ready(function () {
        modelSQL.fieldInfo(self._fieldInfo,self._priKey);
        var sql = modelSQL.updateSQL(args[0]);
        delete modelSQL;
        THIS.resolve(sql);
      });
    }).when(function(sql){
      var THIS = this;
      self._sql(sql);
      conn.query(sql,self._trycatch(function(rs){
        THIS.resolve(rs);
      }));
    }).then(function(result){
      var promise = this;
      var callback = null;
      var changedRows = 0;
      $.each(result,function(){
        changedRows+=this.changedRows;
      });
      if($.type(args[1]) == "function"){
        callback = promise.try(args[1]);
        callback.call(promise,changedRows,result);
      }else{
        promise.resolve(changedRows,result);
      }
    });
  },
  delete:function(){
    var self = this;
    var args = [];
    var callback = null;
    if($.type(arguments[arguments.length-1]) == "function"){
        args = Array.prototype.slice.call(arguments,0,arguments.length - 1);
        callback = arguments[arguments.length - 1];
    }else{
        args = Array.prototype.slice.call(arguments);
    }

    //走主库
    var conn = self._source.master;
    var modelSQL = self._createNewModelSQL();

    //返回一个promise对象 后面可以用链式
    return new Promise(function(){
        var promise = this;
        callback && (callback = promise.try(callback));
        self._ready(function () {
            modelSQL.fieldInfo(self._fieldInfo,self._priKey);
            modelSQL.where.apply(modelSQL,args);
            var sql = modelSQL.deleteSQL();
            delete modelSQL;

            conn.query(sql,self._trycatch(function(rs){
              var affectedRows = rs.affectedRows;
              args = Array.prototype.slice.call(arguments);
              args.unshift(affectedRows);
              if(callback) {
                callback.apply(promise, args);
              }else{
                promise.resolve(affectedRows,arguments[0]);
              }
            }));
        });
    });
  },
  insert:function(){
    //插入
    var self = this;
    if(arguments.length == 0){
      return self;
    }
    var args = Array.prototype.slice.call(arguments);

    //走主库
    var conn = self._source.master;
    var modelSQL = self._createNewModelSQL();

    //返回一个promise对象 后面可以用链式
    return new Promise(function() {
        var promise = this;
        var callback;
        if($.type(args[1]) == "function"){
            callback = promise.try(args[1]);
        }
        self._ready(function(){
          modelSQL.fieldInfo(self._fieldInfo,self._priKey);
          var sql = modelSQL.insertSQL(args[0]);
          delete modelSQL;
          conn.query(sql,self._trycatch(function(){
            if(self._priKey
              && self._fieldInfo[self._priKey]["Extra"] == "auto_increment"){
              var id = arguments[0].insertId;
              if($.type(args[0]) == "object"){
                args[0][self._priKey] = id;
              }else{
                for (var i = 0; i < args[0].length; i++) {
                  var obj = args[0][i];
                  obj[self._priKey] = id++;
                }
              }
            }
            if(callback){
              callback.call(promise,args[0]);
            }else{
              promise.resolve(args[0]);
            }
          }));
        });
    });
  },
  list:function(){
    var self = this;
    var callback = null;
    var args = null;
    if($.type(arguments[arguments.length-1]) == "function"){
      args = Array.prototype.slice.call(arguments,0,arguments.length - 1);
      callback = arguments[arguments.length - 1];
    }else{
      args = Array.prototype.slice.call(arguments);
    }
    //走从库
    var conn = self._source.slave;

    var modelSQL = self._createNewModelSQL();

    //返回一个promise对象 后面可以用链式
    return new Promise(function(){
      var promise = this;
      callback && (callback = promise.try(callback));
      self._ready(function(){
        modelSQL.fieldInfo(self._fieldInfo,self._priKey);
        modelSQL.where.apply(modelSQL,args);
        var sql = modelSQL.selectSQL();
        delete modelSQL;
        conn.query(sql,self._trycatch(function(){
          if(callback) {
            callback.apply(promise, arguments);
          }else{
            promise.resolve(arguments[0]);
          }
        }));
      });
    });
  },
  get:function(){
    var self = this;
    self.limit(1);
    var args = [];
    var callback = null;
    if($.type(arguments[arguments.length-1]) == "function"){
      args = Array.prototype.slice.call(arguments,0,arguments.length - 1);
      callback = arguments[arguments.length - 1];
    }else{
      args = Array.prototype.slice.call(arguments);
    }
    args[args.length] = function(rs){
      var result = null;
      if(rs && rs.length > 0){
        result = rs[0];
      }
      if(callback){
        callback.call(this,result);
      }else{
        this.resolve(result);
      }
    };
    return self.list.apply(self,args);
  },
  getSingle:function(){
    var self = this;
    self.limit(1);
    var args = [];
    var callback = null;
    if($.type(arguments[arguments.length-1]) == "function"){
      args = Array.prototype.slice.call(arguments,0,arguments.length - 1);
      callback = arguments[arguments.length - 1];
    }else{
      args = Array.prototype.slice.call(arguments);
    }
    args[args.length] = function(rs){
      var result = null;
      if(rs && rs.length > 0){
        result = rs[0];
        for(var key in result){
          result = result[key];
          break;
        }
      }
      if(callback){
        callback.call(this,result);
      }else{
        this.resolve(result);
      }
    };
    return self.list.apply(self,args);
  },
  listSingle:function(){
    var self = this;
    var args = [];
    var callback = null;
    if(util.type(arguments[arguments.length-1]) == "function"){
      args = Array.prototype.slice.call(arguments,0,arguments.length - 1);
      callback = arguments[arguments.length - 1];
    }else{
      args = Array.prototype.slice.call(arguments);
    }
    args[args.length] = function(rs){
      var result = [];
      if(rs && rs.length > 0){
        for(var i=0;i<rs.length;i++){
          for(var key in rs[i]){
            result.push(rs[i][key]);
            break;
          }
        }
      }
      if(callback){
        callback.call(this,result);
      }else{
        this.resolve(result);
      }
    };
    return self.list.apply(self,args);
  },
  count:function(){
    var self = this;
    self.field("count(*)");
    return self.getSingle.apply(self,arguments);
  },
};

$.each(ModelSQL.api,function(key,value){
  Model.prototype[key] = function(){
    value.apply(this._modelSQL,arguments);
    return this;
  }
});
