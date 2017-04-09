/**
 * @author xhz
 */
;!function(){
  "use strict";
  var WAIT = 0,SUCCESS = 1,FAILED = 2,EXCEPTION = 3,FINALLY = 4;

  function isArray(obj){
    return Object.prototype.toString.call(obj) === "[object Array]"
  }

  function isFunction(fn){
    return typeof fn === "function";
  }

  function Promise(callback){
    this._status = WAIT;
    this._prev = null;
    this._next = null;
    this._count = 0;
    this._successCount = 0;
    this._failedCount = 0;
    this._successCallback = null;
    this._failedCallback = null;
    this._exception = null;
    this._data = null;

    this._exceptionCallback = null;
    this._finallyCallback = null;

    this._whenData = null;
    this._whenCallback = null;


    return this._init(callback);
  }

  module.exports = Promise;

  Promise.prototype = {
    constructor:Promise,
    _init:function(callback){
      var self = this;
      if(!callback){
        return;
      }
      return self.success(callback);
    },
    _done:function(status){
      var self = this;
      self._status = status;
      if(status === EXCEPTION){
        var next = self;
        while(next){
          if(next._exceptionCallback || next._finallyCallback){
            self.trycatch(next._exceptionCallback,self._exception);
            next._done(FINALLY);
            break;
          }
          next = next._next;
        }
      }else if(status == SUCCESS){
        if(!self._next) return;
        if(self._whenCallback){
          var data = self._whenData || self._data;
          if(!isArray(data)){
            self._exception = "when 方法参数出错";
            self._done(EXCEPTION);
            return self;
          }
          self._next._count = data.length;
          data.forEach(function(item,index){
            if(self._next.trycatch(self._whenCallback,item,index)){
              return;
            }
          });
        }else if(self._successCallback){
          self._next.trycatch(self._successCallback,self._data);
        }
        self._done(FINALLY);
      }else if(status == FAILED){
        if(self._next && self._failedCallback){
          self._next.trycatch(self._failedCallback,self._data);
        }
        self._done(FINALLY);
      }else if(status == FINALLY){
        self.trycatch(self._finallyCallback);
        self._next && self._next.trycatch(self._next._finallyCallback);
      }
    },
    try:function(fn){
      var self = this;
      return function(){
        try{
          fn && fn.apply(self,arguments);
        }catch(e){
          self._exception = e;
          self._done(EXCEPTION);
        }
      }
    },
    trycatch:function(){
      var self = this;
      var fn = arguments[0];
      var args = Array.prototype.slice.call(arguments,1);
      try{
        fn && fn.apply(self,args);
      }catch(e){
        self._exception = e;
        self._done(EXCEPTION);
        return true;
      }
    },
    success:function(success){
      var self = this;
      var p = new Promise();
      p._prev = self;
      self._next = p;
      p._count = 1;
      if(self._prev == null || self._status == SUCCESS){
        p.trycatch(success,self._data);
      }else{
        self._successCallback = success;
      }
      return p;
    },
    failed:function(failed){
      if(!failed) return null;
      var self = this;
      var p = self._next;
      if(!p){
        var p = new Promise();
        p._prev = self;
        self._next = p;
        p._count = 1;
      }
      if(self._status === FAILED){
        p.trycatch(failed,self._data);
      }else{
        self._failedCallback = failed;
      }

      return p;
    },
    then:function(success,failed){
      var self = this;
      var p = self.success(success);
      self.failed(failed);
      return p;
    },
    when:function(data,callback){
      var self = this;
      if(isFunction(data)){
        callback = data;
        data = self._data;
      }

      var p = new Promise();
      p._prev = self;
      self._next = p;
      p._data = true;
      if(self._prev == null || self._status == SUCCESS){
        if(!isArray(data)){
          self._exception = "when 方法参数出错";
          self._done(EXCEPTION);
          return self;
        }
        p._count = data.length;
        data.forEach(function(item,index){
          p.trycatch(callback,item,index);
        });
      }else{
        self._whenData = data;
        self._whenCallback = callback;
      }

      return p;
    },
    next:function(){
      return this.resolve.bind(this);
    },
    _setData:function(data,key){
      var self = this;
      if(key && self._data === true){
        self._data = {};
      }else if(self._data === true){
        self._data = [];
      }
      if(self._data){
        key || (key = self._data.length);
        self._data[key] = data;
      }else{
        self._data = data;
      }
    },
    resolve:function(data,key){
      var self = this;
      self._successCount++;
      self._setData(data,key);
      if(self._successCount + self._failedCount == self._count){
        self._done(SUCCESS);
      }
    },
    nodeResolve:function(){
      var self = this;
      return function(err,data){
        if(err){
          self._exception = err;
          self._done(EXCEPTION);
        }else{
          self.resolve(data);
        }
      }
    },
    reject:function(data,key){
      var self = this;
      self._failedCount++;
      self._setData(data,key);
      if(self._successCount + self._failedCount == self._count){
        self._done(FAILED);
      }
    },
    catch:function(callback){
      var self = this;
      //向上看看是不是已经出现了EXCEPTION
      var prev = self;
      while(prev){
        if(prev._exception){
          self.trycatch(callback,prev._exception);
          self._done(FINALLY);
          return self;
        }
        prev = prev._prev;
      }
      self._exceptionCallback = callback;
      return self;
    },
    finally:function(callback){
      var self = this;
      if(self._status != WAIT){
        self.trycatch(callback);
      }else{
        self._finallyCallback = callback;
      }
    }
  };


}();
