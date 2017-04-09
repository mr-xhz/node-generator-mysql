//SQL 组装工厂

var ModelWhereList = require("./model-where-list"),
    ModelWhere = require("./model-where"),
    ModelSetList = require("./model-set-list"),
    modelFormat = require("./model-format");

var $ = require("../util/util");

function ModelSQL(table,logger){
  this._table = table;
  this._logger = logger;
  this._fieldInfo = {};
  this._priKey = "";

  this._limit = "";
  this._orderby = "",
  this._groupby = "",
  this._field = "";
  this._fieldInfo = "",
  this._where = new ModelWhereList();
}

module.exports = ModelSQL;

ModelSQL.api = {
  orderBy: function (orderby) {
    var self = this;
    if(typeof orderby == "undefined"){
      if(!self._orderby){
        return "";
      }
      return " ORDER BY "+self._orderby;
    }
    self._orderby = orderby;
    return self;
  },
  groupBy: function (groupby) {
    var self = this;
    if(typeof groupby == "undefined"){
      if(!self._groupby){
        return "";
      }
      return " GROUP BY "+self._groupby;
    }
    self._groupby = groupby;
    return self;
  },
  field: function (fields) {
    var self = this;
    if(typeof fields == "undefined"){
      if(self._field.length == 0){
          return " * ";
      }else{
        for (var i = 0; i < self._field.length; i++) {
          var m = self._field[i].match(/(.*)\((.*?)\)(.*?)$/im);
          if(m){
            if(m[2] != "*"){
              self._field[i] = m[1]+"(`"+m[2]+"`)"+m[3];
            }
          }else{
            if(self._field[i] == "*"){
              continue;
            }
            self._field[i] = "`"+self._field[i]+"`";
          }

        }
        return " "+self._field.join(",")+" ";
      }
    }else{
      if(typeof fields == "string"){
        fields = fields.split(",");
      }
      self._field = fields;
    }
    return self;
  },
  limit: function (start,size) {
    var self = this;
    if(typeof start == "undefined"){
      if(!self._limit){
        return "";
      }
      return " LIMIT "+self._limit;
    }
    self._limit = Number(start);
    if(typeof size != "undefined"){
      self._limit+=","+Number(size);
    }
    return self;
  },
  or:function(){
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    args.push("or");
    self.where.apply(self,args);
  },
  where: function () {
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    if (args.length == 0) {
      var strWhere = self._where.toString();
      if(strWhere){
        strWhere = " WHERE "+strWhere;
      }
      return strWhere;
    }
    if (args.length == 1 && typeof args[0] != "object") {
      args[1] = args[0];
      args[0] = self._priKey;
    }
    self._where.where.apply(self._where, args);
    return self;
  }
};

ModelSQL.prototype = {
  _sql:function(){
    var self = this;
    var logger = self._logger || {};
    logger.sql && logger.sql.apply(logger,arguments);
  },
  _getInsertFileds: function () {
    var self = this;
    var fields = {};
    for(var key in self._fieldInfo){
      if(self._fieldInfo[key]["Extra"] ==  "auto_increment"){
        continue;
      }
      fields[key] = self._fieldInfo[key];
    }
    return fields;
  },
  //////////////////////////////////////////////////////////////
  clean:function(){
    var self = this;
    self._where.clean();
    self._limit = "";
    self._groupby = "";
    self._orderby = "";
    self._field = [];
    return self;
  },
  fieldInfo:function(fieldInfo,priKey){
    var self = this;
    if(typeof fieldInfo == "undefined"){
      return self._fieldInfo;
    }
    self._fieldInfo = fieldInfo;
    self._priKey = priKey || "";
  },
  _updateSQLList:function(){
    var self = this;
    var sql = [];
    var header = "UPDATE `"+self._table+"` SET ";
    if ($.type(arguments[0]) == "object"){
      var where = self.where();
      var priKeyWhere = "";
      arguments[0][self._priKey] && (priKeyWhere = new ModelWhere(self._priKey,arguments[0][self._priKey]).toString());
      if(priKeyWhere){
        if(!where){
          where = " WHERE "+priKeyWhere;
        }else{
          where+=" AND "+priKeyWhere;
        }
      }else if(!where){
        return [];
      }
      var sql1 = header+new ModelSetList(arguments[0],self._fieldInfo)+where;
      sql.push(sql1);
    }else if(util.type(arguments[0]) == "array"){
      for (var i = 0; i < arguments[0].length; i++) {
        var obj = arguments[0][i];
        var result = self._updateSQLList(obj);
        if(result.length > 0){
          sql.push(result[0]);
        }
      }
    }else{
      return [];
    }
    return sql;
  },
  deleteSQL:function(){
    var self = this;
    var sql = "DELETE FROM `"+self._table+"`"+self.where();
    self._sql(sql);
    return sql;
  },
  updateSQL:function(){
    var self = this;
    var sql = self._updateSQLList.apply(self,arguments);
    return sql;
  },
  insertSQL:function(insertObject){
    var self = this;
    var fields = self._getInsertFileds();
    var arrFields = [];
    for(var key in fields){
      arrFields.push("`"+key+"`");
    }
    var sql = "INSERT INTO `"+self._table+"`("+arrFields.join(",")+") VALUES ";
    var values = [];
    var tmp = insertObject;
    if(util.type(insertObject) == "object"){
      tmp = [insertObject];
    }
    for (var i = 0; i < tmp.length; i++) {
      var obj = tmp[i];
      var insertValue = [];
      for(var key in fields){
        var value = obj[key];
        if(util.type(value) == "undefined"){
          value = fields[key]["Default"];
          if(util.type(value) == "undefined" ||util.type(value) == "null" || value == ''){
            value = "null";
          }
        }else if(util.type(value) == "null"){
          value = "null";
        }
        if(value != "null"){
          value = modelFormat.format(value);
        }
        insertValue.push(value);
      }
      values.push("("+insertValue.join(',')+")");
    }
    sql+=values.join(",");
    self._sql(sql);
    return sql;
  },
  selectSQL:function(){
    var self = this;
    var sql = "SELECT"+self.field()+"FROM `"+self._table+"`"+self.where()+self.groupBy()+self.orderBy()+self.limit();
    self._sql(sql);
    return sql;
  }
};

$.each(ModelSQL.api,function(key,value){
  ModelSQL.prototype[key] = function(){
    return value.apply(this,arguments);
  }
});
