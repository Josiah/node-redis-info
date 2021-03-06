var _ = require('lodash');

function Parser(info){
  this._info = this._splitStr(info);

  Object.defineProperty(this, 'fields', {
    get: this.parseFields.bind(this)
  });
}


function startWith(pattern){
  return function(value){
    return value.indexOf(pattern) === 0;
  };
}

function contains(pattern){
  return function(value){
    return value.indexOf(pattern) !== -1;
  };
}

function split(s){return function(v){return v.split(s);};};

function defstr(v){return v || '';}

function defint(v){return v || 0;}

function apply(func){
  return function(v){
    return func.apply(this, v);
  };
}

function takeN(func, n){return function(v){return func(v[n]);};}

function takeFirst(func){return takeN(func, 0);}

/**
 * Split the info string by \n and :
 * @param  {String} str the returned redis info
 * @return {Array}     Array of [key, value]
 */
Parser.prototype._splitStr = function(str){
  return str.split('\n')
    .filter(function(line){return line.length > 0 && line.indexOf('#') !== 0;})
    .map(function(line){return line.trim().split(':');});
};

Parser.prototype.parseDatabases = function(){
  return this._info
    .filter(takeFirst(startWith('db')))
    .map(apply(this._parseDatabaseInfo))
    .reduce(function(m, v){
      m[v.index] = {
        keys: v.keys
      , expires: v.expires
      };
      return m;
    }, {});
};

Parser.prototype.parseCommands = function(){
  return _.zipObject(this._info
    .filter(function(a){return defstr(a[0]).indexOf('cmdstat_') === 0;})
    .map(apply(this._parseCommands)));
};

Parser.prototype._parseCommands = function(v, a){
  var val = _.zipObject(defstr(a).split(',').map(split('=')));
  if(_.has(val, 'calls')){val.calls = parseInt(val.calls, 10);}
  if(_.has(val, 'usec')){val.usec = parseInt(val.usec, 10);}
  if(_.has(val, 'usec_per_call')){val.usec_per_call = parseFloat(val.usec_per_call, 10);}
  return [defstr(v).split('_')[1], val];
};

Parser.prototype.parseFields = function() {

  var fields = this._info.reduce(function(m, v){
    if(!v[0].trim() || v[0].indexOf('db') === 0 || v[0].indexOf('cmdstat_') === 0){return m;}
    m[v[0]] = v[1];
    return m;
  }, {
    databases: this.parseDatabases(),
    commands: this.parseCommands()
  });

  return fields;
};

Parser.prototype._parseDatabaseInfo = function(dbName, value) {
  var values = defstr(value).split(',');

  function extract(param){
    return parseInt(defint(defstr(_.detect(values, startWith(param))).split('=')[1]), 10);
  }

  return {
    index  : parseInt(dbName.substr(2), 10)
  , keys   : extract('keys')
  , expires: extract('expires')
  };
};


/**
 * Return all info properties that start with "pattern"
 * @param  {String} pattern the pattern
 * @return {Array}  an array of [key, value]
 */
Parser.prototype.startWith = function(pattern){
  return this._info.filter(takeFirst(startWith(pattern)));
};

/**
 * Return all info properties that contains "pattern"
 * @param  {String} pattern the pattern
 * @return {Array}  an array of [key, value]
 */
Parser.prototype.contains = function(pattern){
  return this._info.filter(takeFirst(contains(pattern)));
};

module.exports = {
  parse: function(info){
    return new Parser(info);
  }
};
