Components.utils.import("resource://sqlitemanager/sqlite.js");
Components.utils.import("resource://sqlitemanager/fileIO.js");

//this object holds user-defined functions and related stuff
var smUDF = {
  dbFunc: null,

  //connect to smFunctions.sqlite; if this is the first time, copy the supplied db file to location of user's choice
  initFunctionDb: function() {
    var udfDbDirPath = sm_prefsBranch.getCharPref("udfDbDirPath");

    while (udfDbDirPath == "") {
      //select a dir
      var dir = sm_chooseDirectory("Choose location of user-defined functions database (smFunctions.sqlite)...");
      if (dir == null) {
        var bNow = confirm("Please choose a directory before proceeding.\nIf you already have smFunctions.sqlite file, then choose the directory where it is located.\nIf you do NOT have an existing smFunctions.sqlite file, then one will be created in the directory you choose.\nPress OK to choose a directory now.\nPress Cancel if you want to choose later.");
        if (!bNow)
          return false;

        continue;
      }

      sm_prefsBranch.setCharPref("udfDbDirPath", dir.path);
      udfDbDirPath = sm_prefsBranch.getCharPref("udfDbDirPath");
    }

    //copy the supplied db if none exists
    if (!this.getFuncDbFile().exists()) {
      //find the location of this extension/xul app
      var fileOrig = FileIO.getFile(gExtLocation);
      fileOrig.append('extra');
      fileOrig.append('smFunctions.sqlite');
      fileOrig.copyTo(this.getFuncDbDir(), "");
    }

    this.dbFunc = new SQLiteHandler();
    this.dbFunc.openDatabase(this.getFuncDbFile());

    return true;
  },

  getFuncDbDir: function() {
    var udfDbDirPath = sm_prefsBranch.getCharPref("udfDbDirPath");
    var fileDb = FileIO.getFile(udfDbDirPath);
    return fileDb;
  },

  getFuncDbFile: function() {
    var fileDb = this.getFuncDbDir();
    fileDb.append("smFunctions.sqlite");
    return fileDb;
  },

  getDbFunctions: function() {
    if (this.dbFunc == null)
      return [];

    var allUdf = [];

    this.dbFunc.selectQuery('SELECT body, argLength FROM func_definitions');
    var records = this.dbFunc.getRecords();
    for (var i in records) {
      eval("func = " + records[i][0]);
      var udf = {fName: func.name, fLength: records[i][1],
                  onFunctionCall: func};
      allUdf.push(udf);
    }
    return allUdf;
  }
};

//a trial: enveloping a udf
function xxx12345aaa(val) {
  var valArr = [];
  for (var j = 0; j < val.numEntries; j++) {
    switch (val.getTypeOfIndex(j)) {
      case 0: //NULL
        valArr.push(null);
        break;
      case 1: //INTEGER
        valArr.push(val.getInt64(j));
        break;
      case 2: //FLOAT
        valArr.push(val.getDouble(j));
        break;
      case 3: //TEXT
      default:
        valArr.push(val.getString(j));   
    }
  }

  function yyy(s, t) {
    return s + t + 100;
  }
  return yyy.apply(this,valArr);
}

