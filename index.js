var mysql = require("mysql");


var $ = require("./lib/util/util"),
    Model = require("./lib/model");
var ModelWhereList = require("./lib/obj/model-where-list");

var _mysql = {
  _config:{},
  _connects:[],
  _arrSource:[],
  _cache:{},
  _getLogger:function(){
    var self = this;
    var logger = self._config.logger;
    logger.error = logger.error || console.log.bind(console);
    return logger;
  },
  _handleError:function(conn,source,database){
    var self = this;

    var logger = self._getLogger();

    return function(err){
      if(err){
        logger.error && logger.error(err);
        if(err.code == 'PROTOCOL_CONNECTION_LOST'){
          self._connect(conn.config,source,database);
        }
      }
    }
  },
  _connect:function(config,source,database){
    var self = this;
    var conn = mysql.createConnection(config);
    conn.connect(self._handleError(conn,source,database));
    conn.on('error',self._handleError(conn,source,database));
    source[database] = conn;
    if(!source.hasSlave){
      source["slave"] = conn;
    }
    return conn;
  },
  modelWhereList:function(){
    return new ModelWhereList();
  },
  model:function(modelName){
    //根据name 看看是属于哪个 source
    var self = this;
    if(self._cache[modelName]){
      return self._cache[modelName];
    }
    var arrSource = self._arrSource;

    var logger = self._getLogger();

    var model = null;
    $.each(arrSource,function(index,source){
      if(!source.prefix){
        model = new Model(modelName,source,self._config.logger);
        return false;
      }
      $.each(source.model,function(i,m){
        if(this == modelName){
          model = new Model(modelName,source,self._config.logger);
          return false;
        }
      });
      if(model != null) return false;
      var r = new RegExp("^"+source.prefix,"i");
      if(r.test(modelName)){
        model = new Model(modelName,source,self._config.logger);
        return false;
      }
    });
    if(model == null){
      logger.error && logger.error("mysql.js can not find model:"+modelName);
    }else{
      self._cache[modelName] = model;
    }
    return model;
  },

  configure:function(config){
    config = config || {};
    config.logger = config.logger || {};
    this._config = config;
    return this;
  },
  connect:function(){
    var self = this;
    var dataSource = self._config.dataSource;

    dataSource.forEach(function(item){
      var arrUrl = item.url.split(",");
      var arrConfig = [];
      arrUrl.forEach(function(url){
        arrConfig.push({
          host:url.split(":")[0],
          port:url.split(":")[1].split("/")[0],
          database:url.split(":")[1].split("/")[1],
          user:item.user,
          password:item.password
        });
      });

      var source = {
        master:null,
        slave:null,
        prefix:item.prefix || "",
        model:item.model || [],
        hasSlave:arrConfig.length > 1
      };
      arrConfig.forEach(function(config){
        var database = "master";
        if(source.master != null){
          database = "slave";
        }
        self._connect(config,source,database);
      });
      self._arrSource.push(source);
    });
    return self;
  }
};

module.exports = _mysql;
