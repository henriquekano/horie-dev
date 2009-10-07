let EXPORTED_SYMBOLS = ["SQLiteTypes", "SQLiteHandler", "SQLiteFn"];

//https://developer.mozilla.org/en/mozIStorageValueArray
const SQLiteTypes = {
  NULL   : 0,
  INTEGER: 1,
  FLOAT  : 2,
  TEXT   : 3,
  BLOB   : 4
};

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

function SQLiteHandler() {
  this.storageService = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
  this.consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
  this.promptService = 	Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
}

SQLiteHandler.prototype = {
  dbConn: null,
  mbShared: true,
  mOpenStatus: "",

  aTableData: null,       // Stores 2D array of table data
	aTableType: null,
  aColumns: null,

	colNameArray: null,
	resultsArray: null,
	statsArray: null,

  maDbList: ["main", "temp"],
  mLogicalDbName: "main", //for main, temp and attached databases

	lastErrorString: "",
  miTime: 0, //time elapsed during queries

  mFuncConfirm: null,
  mBlobPrefs: {sStrForBlob: 'BLOB', bShowSize: true, iMaxSizeToShowData: 100},

  // openDatabase: opens a connection to the db file nsIFile
  // bShared = true: first attempt shared mode, then unshared
  // bShared = false: attempt unshared cache mode only
  openDatabase: function(nsIFile, bShared) {
    this.closeConnection();

 		try {
  	  if (!bShared) // dummy exception to reach catch to use openUnsharedDatabase
        throw 0;

      this.dbConn = this.storageService.openDatabase(nsIFile);
      this.mbShared = true;
			// if the db does not exist it does not give us any indication
			// this.dbConn.lastErrorString returns "not an error"
		}
		catch (e) { //attempt unshared connection
  		try {
        this.dbConn = this.storageService.openUnsharedDatabase(nsIFile);
        this.mbShared = false;
  			// if the db does not exist it does not give us any indication
  			// this.dbConn.lastErrorString returns "not an error"
  		}
  		catch (e) {
  		  try {
          this.dbConn = this.openSpecialProfileDatabase(nsIFile);
  		  }
  		  catch (e) {
    			this.onSqlError(e, "Error in opening file " + nsIFile.leafName + " - perhaps this is not an sqlite db file", null);
    			return false;
    		}
  		}
    }
		
		if(this.dbConn == null)
			return false;
		this.mOpenStatus = this.mbShared?"Shared":"Exclusive";
		return true;
  },

  openSpecialProfileDatabase: function(nsIFile) {
    var DirectoryService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var profD = DirectoryService.get('ProfD', Ci.nsIFile);
    if (nsIFile.parent.equals(profD)) {
      switch (nsIFile.leafName.toLowerCase()) {
        case "places.sqlite":
          if ('nsPIPlacesDatabase' in Ci) {
            return Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService).QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
          }
          break;
      }
    }
    return null;
  },

  openSpecialDatabase: function(sSpecialName) {
    if (sSpecialName != "memory")
      return false;
    this.closeConnection();

 		try {
      this.dbConn = this.storageService.openSpecialDatabase(sSpecialName);
		}
		catch (e) {
			this.onSqlError(e, "Error in opening in memory database", null);
			return false;
    }

		if(this.dbConn == null)
			return false;
		this.mOpenStatus = "Memory";
		return true;
  },

  closeConnection: function() {
    if (this.dbConn != null) {
      try {
        this.dbConn.close();
      } catch (e) {
        this.dbConn = null;
      }
    }

    this.aTableData = null;
    this.aTableType = null;
    this.aColumns = null;
    this.mOpenStatus = "";
  },

  createFunction: function(fnName, argLength, fnObject) {
    if (funcNamesAll.indexOf(fnName) != -1) {
      this.logMessage("Cannot create function called: " + fnName + "\nThis name belongs to a core, aggregate or datetime function.");
      return;
    }
    try {
      this.dbConn.createFunction(fnName, argLength, fnObject);
    } catch (e) {
      this.onSqlError(e, "Failed to create storage function: " + fnName);    
    }
  },

  getOpenStatus: function() { return this.mOpenStatus; },
  getElapsedTime: function() { return this.miTime; },
  getRecords: function() { return this.aTableData; },
  getRecordTypes: function() { return this.aTableType; },
  getColumns: function() { return this.aColumns; },
	getLastError: function() { return this.lastErrorString;	},

	setErrorString: function() {
		this.lastErrorString = this.dbConn.lastErrorString;
	},

  get logicalDbName() { return this.mLogicalDbName; },
  get schemaVersion() { return this.dbConn.schemaVersion;	},

	setLogicalDbName: function(sDbName) {
    this.mLogicalDbName = sDbName;
	},

	setBlobPrefs: function(sStrForBlob, bShowBlobSize, iMaxSizeToShowBlobData) {
    this.mBlobPrefs.sStrForBlob = sStrForBlob;
    this.mBlobPrefs.bShowSize = bShowBlobSize;
    this.mBlobPrefs.iMaxSizeToShowData = iMaxSizeToShowBlobData;
	},

	setFuncConfirm: function(oFunc) {
    this.mFuncConfirm = oFunc;
	},

  getPrefixedName: function(objName, sDbName) {
    if (sDbName == "")
      sDbName = this.mLogicalDbName;

    return SQLiteFn.quoteIdentifier(sDbName) + "." + SQLiteFn.quoteIdentifier(objName);
  },

  getPrefixedMasterName: function(sDbName) {
    if (sDbName == "")
      sDbName = this.mLogicalDbName;

    if (sDbName == "temp")
      return "sqlite_temp_master";
    else
      return SQLiteFn.quoteIdentifier(sDbName) + ".sqlite_master";
  },

  getFileName: function() {
    if (this.dbConn != null)
	    return this.dbConn.databaseFile.leafName;
	  return null;
	},

  getFile: function() {
    if (this.dbConn != null)
	    return this.dbConn.databaseFile;
	  return null;
	},

  get sqliteVersion() {
		this.selectQuery("SELECT sqlite_version()");
		return this.aTableData[0][0];
  },

	setSetting: function(sSetting, sValue) {
		if (sSetting == "encoding" || sSetting == "temp_store_directory")
			sValue = "'" + sValue + "'";
		var sQuery = "PRAGMA " + sSetting + " = " + sValue;
		//do not execute in a transaction; some settings will cause error
		this.selectQuery(sQuery);

		return this.getSetting(sSetting);
	},

	getSetting: function(sSetting) {
		var iValue = null;
    try {
  		this.selectQuery("PRAGMA " + sSetting);
  		iValue = this.aTableData[0][0];
	  	return iValue;
	  } catch (e) {
	    if (sSetting == "temp_store_directory")
	      return '';
	    else
	      this.alert("PRAGMA " + sSetting + ": exception - " + e.message);
	  }
	},
	
  tableExists: function(sTable, sDbName) {
    if (typeof sDbName == "undefined")
      return this.dbConn.tableExists(sTable);
    else {
      var aList = this.getObjectList("table", sDbName);
      if (aList.indexOf(sTable) >= 0)
        return true;
    }
    return false;
  },

  //getObjectList: must return an array of names of type=argument 
  // Type = master|table|index|view|trigger,
  //empty array if no object found
  getObjectList: function(sType, sDb) {
    if (sDb == "")
      sDb = this.mLogicalDbName;

    var aResult = [];

    if (sType == "master") {
      aResult = ["sqlite_master"];
      if (sDb == "temp")
        aResult = ["sqlite_temp_master"];
      return aResult;    
    }

    var sTable = this.getPrefixedMasterName(sDb);
    var sQuery = "SELECT name FROM " + sTable + " WHERE type = '"
					+ sType + "' ORDER BY name";
		this.selectQuery(sQuery);

		for (var i = 0; i < this.aTableData.length; i++)
			aResult.push(this.aTableData[i][0]);

		return aResult;
  },
  // loadTableData: retrieves data from a table including rowid if needed
  // return r: -1 = error, 0 = ok without extracol,
  // r > 0 means column number of extracol starting with 1
  loadTableData: function(sObjType, sObjName, aArgs) {
  	if (sObjType != "master" && sObjType != "table" && sObjType != "view")
  		return -1;
  		
    var sCondition = aArgs.sWhere?aArgs.sWhere:"";
    var iLimit = aArgs.iLimit?aArgs.iLimit:-1;
    var iOffset = aArgs.iOffset?aArgs.iOffset:0;
    var sOrder = "";
    if (aArgs.aOrder && aArgs.aOrder.length > 0) {
      var aTemp = [];
      for (var i = 0; i < aArgs.aOrder.length; i++) {
        aTemp.push(SQLiteFn.quoteIdentifier(aArgs.aOrder[i][0]) + " " + aArgs.aOrder[i][1]);
      }
      sOrder = " ORDER BY " + aTemp.join(", ") + " ";
    }

		var extracol = "";
		var iRetVal = 0;
  	var sLimitClause = " LIMIT " + iLimit + " OFFSET " + iOffset;
  	
  	if (sObjType == "table" || sObjType == "master") {
	    //find whether the rowid is needed 
			//or the table has an integer primary key
			var rowidcol = this.getTableRowidCol(sObjName);
			if (rowidcol["name"] == "rowid") {
				extracol = " `rowid`, ";
				iRetVal = 1;
			}
		}
    //table having columns called rowid behave erratically
    sObjName = this.getPrefixedName(sObjName, "");
		this.selectQuery("SELECT " + extracol + " * FROM " + sObjName + " "	+ sCondition + sOrder + sLimitClause);
		return iRetVal;
	},

	//for tables and views
	getRowCount: function(sObjName, sCondition) {
		var iValue = 0;
		sObjName = this.getPrefixedName(sObjName, "");
		var sQuery = "SELECT count(*) FROM " + sObjName + " " + sCondition;
		this.selectQuery(sQuery);

		iValue = this.aTableData[0][0];
		return iValue;
	},
	
	//for count of indexes/triggers of a table
	getObjectCount: function(sTable, sDb) {
    var sMaster = this.getPrefixedMasterName(sDb);
		var sQuery = "SELECT type, count(*) AS cnt FROM " + sMaster + " WHERE tbl_name = '" + sTable + "' AND type IN ('index', 'trigger') GROUP BY type";

    var stmt = this.dbConn.createStatement(sQuery);
    var oRow = {indexCount: 0, triggerCount: 0};
    try {
      while (stmt.executeStep()) {
        if (stmt.row.type == 'index')
          oRow.indexCount = stmt.row.cnt;
        if (stmt.row.type == 'trigger')
          oRow.triggerCount = stmt.row.cnt;
      }
    } finally {
      stmt.reset();
    }
 		return oRow;
	},
	
	emptyTable: function(sTableName) {
		var sQuery = "DELETE FROM " + this.getPrefixedName(sTableName, "");
		return this.confirmAndExecute([sQuery], "Delete All Records");
	},

	renameTable: function(sOldName, sNewName, sDb) {
		var sQuery = "ALTER TABLE " + this.getPrefixedName(sOldName, sDb) + " RENAME TO " + SQLiteFn.quoteIdentifier(sNewName);
		return this.confirmAndExecute([sQuery], "Rename table " + sOldName);
	},

	analyzeTable: function(sTableName) {
		var sQuery = "ANALYZE " + this.getPrefixedName(sTableName, "");
		return this.confirmAndExecute([sQuery], "Analyze Table");
	},

	//sObject = TABLE/INDEX/COLLATION;
	reindexObject: function(sObjectType, sObjectName) {
		var sQuery = "REINDEX " + this.getPrefixedName(sObjectName, "");
		return this.confirmAndExecute([sQuery], sQuery);
	},

	//sObjType = TABLE/INDEX/VIEW/TRIGGER;
	dropObject: function(sObjType, sObjectName) {
		var sQuery = "DROP " + sObjType + " " + this.getPrefixedName(sObjectName, "");
		return this.confirmAndExecute([sQuery], sQuery);
	},

  addColumn: function(sTable, aColumn) {
		var aQueries = [];
		var coldef = SQLiteFn.quoteIdentifier(aColumn["name"]) + " " + aColumn["type"];
		if (aColumn["notnull"])
		  coldef += " NOT NULL ";
		if (aColumn["dflt_value"] != null) {
			coldef += " DEFAULT " + aColumn["dflt_value"];
		}
		var sTab = this.getPrefixedName(sTable, "");
		var sQuery = "ALTER TABLE " + sTab + " ADD COLUMN " + coldef;
		return this.confirmAndExecute([sQuery], "Add Column to Table " + sTable);
  },

  // selectQuery : execute a select query and store the results
  selectQuery: function(sQuery, bBlobAsHex) {
    this.aTableData = new Array();
    this.aTableType = new Array();
// if aColumns is not null, there is a problem in tree display
    this.aColumns = null;        
    var bResult = false;
 
    var timeStart = Date.now();
    try {		// mozIStorageStatement
			var stmt = this.dbConn.createStatement(sQuery);
		}
		catch (e) {
			// statement will be undefined because it throws error);
			this.onSqlError(e, "Likely SQL syntax error: " + sQuery, this.dbConn.lastErrorString);
			this.setErrorString();
			return false;
		}
		
    var iCols = 0;
    var iType, colName;
		try	{
      // do not use stmt.columnCount in the for loop, fetches the value again and again
      iCols = stmt.columnCount;
			this.aColumns = new Array();
			var aTemp, aType;
			for (var i = 0; i < iCols; i++)	{
        colName = stmt.getColumnName(i);
        aTemp = [colName, iType];
        this.aColumns.push(aTemp);  
			}
		} catch (e) { 
			this.onSqlError(e, "Error while fetching column name: " + colName, null);
    	this.setErrorString();
    	return false;
  	}

    var cell;
   	var bFirstRow = true;
    try {
      while (stmt.executeStep()) {
        aTemp = [];
        aType = [];
        for (i = 0; i < iCols; i++) {
          iType = stmt.getTypeOfIndex(i);
	        if (bFirstRow) {
	        	this.aColumns[i][1] = iType;
	        }
          switch (iType) {
            case stmt.VALUE_TYPE_NULL: 
							cell = null;//SQLiteFn.getStrForNull();
							break;
            case stmt.VALUE_TYPE_INTEGER:
							cell = stmt.getInt64(i);
							break;
            case stmt.VALUE_TYPE_FLOAT:
							cell = stmt.getDouble(i);
							break;
            case stmt.VALUE_TYPE_TEXT:
							cell = stmt.getString(i);
							break;
            case stmt.VALUE_TYPE_BLOB: //TODO: handle blob properly
            	if (bBlobAsHex) {
	              	var iDataSize = {value:0};
	              	var aData = {value:null};
	  							stmt.getBlob(i, iDataSize, aData);
	  							cell = SQLiteFn.blob2hex(aData.value);
            	}
            	else {
	              cell = this.mBlobPrefs.sStrForBlob;
	              if (this.mBlobPrefs.bShowSize) {
	              	var iDataSize = {value:0};
	              	var aData = {value:null};
	  							stmt.getBlob(i, iDataSize, aData);
	  							cell += " (Size: " + iDataSize.value + ")";
	  							if (iDataSize.value <= this.mBlobPrefs.iMaxSizeToShowData || this.mBlobPrefs.iMaxSizeToShowData < 0) {
	  							  cell = this.convertBlobToStr(aData.value);
	  							}
	              }
	            }
							break;
            default: sData = "<unknown>"; 
          }
          aTemp.push(cell);
          aType.push(iType);
        }
        this.aTableData.push(aTemp);
        this.aTableType.push(aType);
        bFirstRow = false;
      }
      this.miTime = Date.now() - timeStart;
    } catch (e) { 
			this.onSqlError(e, "Query: " + sQuery + " - executeStep failed", null);
    	this.setErrorString();
    	return false;
    } finally {
    	stmt.reset();
    }
		this.setErrorString();
    return true;
  },

  exportTable: function(sTableName, sDbName, oFormat) {
    var sQuery = "SELECT * FROM " + this.getPrefixedName(sTableName, sDbName);
    this.selectQuery(sQuery, true);
		var arrData = this.getRecords();
		var arrColumns = this.getColumns();
    var arrTypes = this.getRecordTypes();

		if (oFormat.name == "csv")
      return getCsvFromArray(arrData, arrTypes, arrColumns, oFormat);  
  },

  convertBlobToStr: function(aData) {
	  var str = '';
	  for (var i = 0; i < aData.length; i++) {
		  str += String.fromCharCode(aData[i]);
	  }
	  return str;
  },

  convertBlobToHex: function(aData) {
    var hex_tab = '0123456789ABCDEF';
	  var str = '';
	  for (var i = 0; i < aData.length; i++) {
		  str += hex_tab.charAt(aData[i] >> 4 & 0xF) + hex_tab.charAt(aData[i] & 0xF);
	  }
	  return "X'" + str + "'";
  },
  // selectBlob : execute a select query to return blob
  selectBlob: function(sTable, sField, sWhere) {
		var sQuery = ["SELECT", SQLiteFn.quoteIdentifier(sField), "FROM", this.getPrefixedName(sTable, ""), "WHERE", sWhere].join(' ');
    try {		// mozIStorageStatement
			var stmt = this.dbConn.createStatement(sQuery);
		}
		catch (e) {
			// statement will be undefined because it throws error);
			this.onSqlError(e, "Likely SQL syntax error: " + sQuery, 
			  		this.dbConn.lastErrorString);
			this.setErrorString();
			return false;
		}
		
    if (stmt.columnCount != 1)
      return false;

    var cell;
    try {
      stmt.executeStep();
      if (stmt.getTypeOfIndex(0) != stmt.VALUE_TYPE_BLOB)
        return false;

    	var iDataSize = {value:0};
    	var aData = {value:null};
			stmt.getBlob(0, iDataSize, aData);
			cell = "BLOB (Size: " + iDataSize.value + ")";
      //return [iDataSize.value, aData.value];
      return aData.value;
    } catch (e) { 
			this.onSqlError(e, "Query: " + sQuery + " - executeStep failed", null);
    	this.setErrorString();
    	return false;
    } finally {
    	stmt.reset();
    }
		this.setErrorString();
    return true;
  },

  // getTableRowidCol : execute a pragma query and return the results
  getTableRowidCol: function(sTableName) {
		var aCols = this.getTableInfo(sTableName, "");
		var aReturn = [];

		var iNumPk = 0, iIntPk = 0;
		for(var i = 0; i < aCols.length; i++) {
			var row = this.aTableData[i];
			var type = aCols[i].type;
			var pk = aCols[i].pk;
			type = type.toUpperCase();
			if(pk == 1) {
				iNumPk++;
				if (type == "INTEGER") {
  				iIntPk++;
  				aReturn["name"] = aCols[i].name;
  				aReturn["cid"] = aCols[i].cid;
				}
			}
		}
		if (iNumPk == 1 && iIntPk == 1)
			return aReturn;
		
		aReturn["name"] = "rowid";
		aReturn["cid"] = 0;
		return aReturn;
  },

  getPragmaSchemaQuery: function(sPragma, sObject, sDbName) {
    if (sDbName == "")
      sDbName = this.mLogicalDbName;
    return "PRAGMA " + SQLiteFn.quoteIdentifier(sDbName) + "." + sPragma + "(" + SQLiteFn.quoteIdentifier(sObject) + ")";
  },

  getIndexDetails: function(sIndexName, sDb) {
		var aReturn = {tbl_name: '', unique: 0};

    var row = this.getMasterInfo(sIndexName, '');
    aReturn.tbl_name = row.tbl_name;

		//to find whether duplicates allowed
		var aList = this.getIndexList(aReturn.tbl_name, "");
		for(var i = 0; i < aList.length; i++) {
			if(aList[i].name == sIndexName)
				aReturn.unique = aList[i].unique;
		}
		
		return aReturn;
  },
    
	select : function(file,sql,param) {
		var ourTransaction = false;
		if (this.dbConn.transactionInProgress) {
			ourTransaction = true;
			this.dbConn.beginTransactionAs(this.dbConn.TRANSACTION_DEFERRED);
		}
		var statement = this.dbConn.createStatement(sql);
    if (param) {
			for (var m = 2, arg = null; arg = arguments[m]; m++) 
				statement.bindUTF8StringParameter(m-2, arg);
		}
		try {
			var dataset = [];
			while (statement.executeStep()) {
				var row = [];
				for (var i = 0, k = statement.columnCount; i < k; i++)
					row[statement.getColumnName(i)] = statement.getUTF8String(i);

				dataset.push(row);
			}
			// return dataset;	
		}
		finally {
			statement.reset();
		}
		if (ourTransaction) {
			this.dbConn.commitTransaction();
		}
        return dataset;	
	},
	
	executeTransaction: function(aQueries) {
    //IS THIS NEEDED?
		//commit, if some leftover transaction is in progress
		if (this.dbConn.transactionInProgress)
			this.dbConn.commitTransaction();

    var timeStart = Date.now();
		//begin a transaction, iff no transaction in progress
		if (!this.dbConn.transactionInProgress)
			this.dbConn.beginTransaction();

		for(var i = 0; i < aQueries.length; i++) {
	    try {
				var statement = this.dbConn.createStatement(aQueries[i]);
				statement.execute();
				this.setErrorString();
			}
			catch (e) {
				// statement will be undefined because it throws error);
				this.onSqlError(e, "Likely SQL syntax error: " + aQueries[i], this.dbConn.lastErrorString);
				this.setErrorString();
				if (this.dbConn.transactionInProgress) {
					this.dbConn.rollbackTransaction();
				}
				return false;
			}
			finally {
				statement.reset();
			}
		}
		//commit transaction, if reached here
		if (this.dbConn.transactionInProgress)
			this.dbConn.commitTransaction();

    this.miTime = Date.now() - timeStart;
		return true;
	},	

 // executeWithParams : execute a query with parameter binding
  executeWithParams: function(sQuery, aParamData) {
  	try {
			var stmt = this.dbConn.createStatement(sQuery);
		} catch (e) {
			this.onSqlError(e, "Create statement failed: " + sQuery, 
							this.dbConn.lastErrorString);
			this.setErrorString();
			return false;
		}

		for (var i = 0; i < aParamData.length; i++) {
			var aData = aParamData[i];
			switch (aData[2]) {
				case "blob":
					try {
						stmt.bindBlobParameter(aData[0], aData[1], aData[1].length);
					} catch (e) {
						this.onSqlError(e, "Binding failed for parameter: " + aData[0], 
										this.dbConn.lastErrorString);
						this.setErrorString();
						return false;
					}
					break;
			}
		}
		try {
			stmt.execute();
		} catch (e) {
			this.onSqlError(e, "Execute failed: " + sQuery, this.dbConn.lastErrorString);
			this.setErrorString();
			return false;
		}

		try {
			stmt.reset();
			stmt.finalize();
		} catch (e) {
				this.onSqlError(e, "Failed to reset/finalize", this.dbConn.lastErrorString);
				this.setErrorString();
				return false;
		}
		return true;
  },

	confirmAndExecute: function(aQueries, sMessage, confirmPrefName, aParamData) {
	  var answer = true;
	  //function for confirmation should not be hardcoded
	  if (this.mFuncConfirm != null)
		  answer = (this.mFuncConfirm)(aQueries, sMessage, confirmPrefName);

		if(answer) {
			if (aParamData)
				return this.executeWithParams(aQueries[0], aParamData);
			else
				return this.executeTransaction(aQueries);
		}
		return false;
	},

	executeWithoutConfirm: function(aQueries, aParamData) {
		if (aParamData)
			return this.executeWithParams(aQueries[0], aParamData);
		else
			return this.executeTransaction(aQueries);
	},

	executeSimpleSQLs: function(aQueries) {
    for (var i=0; i < aQueries.length; i++) {
      this.dbConn.executeSimpleSQL(aQueries[i]);    
    }
	},

	onSqlError: function(ex, msg, SQLmsg) {
	  msg = "SQLiteManager: " + msg;
		if (SQLmsg != null)
			msg += " [ " + SQLmsg + " ]";

		msg += "\n";
		msg += "Exception Name: " + ex.name + "\n" +
					"Exception Message: " + ex.message;
		this.alert(msg);
    Cu.reportError(msg);
		return true;
	},

  alert: function(sMsg) {
    this.promptService.alert(null, "SQLite Manager Alert", sMsg);
  },

  logMessage: function(sMsg) {
    this.consoleService.logStringMessage("SQLiteManager: " + sMsg);
  },

	getMasterInfo: function(sObjName, sDbName) {
    var sTable = this.getPrefixedMasterName(sDbName);
		var sQuery = "SELECT * FROM " + sTable + " WHERE name = '" + sObjName + "'";
    var stmt = this.dbConn.createStatement(sQuery);
    var aRows = [];
    try {
      while (stmt.executeStep()) {
        var oRow = {};

        oRow.type = stmt.row.type;
        oRow.name = stmt.row.name;
        oRow.tbl_name = stmt.row.tbl_name;
        oRow.rootpage = stmt.row.rootpage;
        oRow.sql = stmt.row.sql;

        aRows.push(oRow);
      }
    } finally {
      stmt.reset();
    }
    if (aRows.length > 0)
  		return aRows[0];
  	else
  		return aRows;
	},

/////////////////////////////////////////////
//The following functions are for Pragmas to query the database schema
/////////////////////////////////////////////

//functions for db list (main, temp and attached)
  getDatabaseList: function() {
		var sQuery = "PRAGMA database_list";
    var stmt = this.dbConn.createStatement(sQuery);
		var aRows = ["main", "temp"];
    try {
      while (stmt.executeStep()) {
		    if (stmt.row.seq > 1) //sometimes, temp is not returned
          aRows.push(stmt.row.name);
      }
    } finally {
      stmt.reset();
    }
		return aRows;
  },

  getForeignKeyList: function(sTableName, sDbName) {
		var sQuery = this.getPragmaSchemaQuery("foreign_key_list", sTableName, sDbName);
    var stmt = this.dbConn.createStatement(sQuery);
    var aRows = [];
    try {
      while (stmt.executeStep()) {
        var oRow = {};

        oRow.id = stmt.row.id;
        oRow.seq = stmt.row.seq;
        oRow.table = stmt.row.table;
        oRow.from = stmt.row.from;
        oRow.to = stmt.row.to;
        oRow.on_update = stmt.row.on_update;
        oRow.on_delete = stmt.row.on_delete;
        oRow.match = stmt.row.match;

        aRows.push(oRow);
      }  
    } finally {
      stmt.reset();
    }
		return aRows;
  },

  getTableInfo: function(sTableName, sDbName) {
		var sQuery = this.getPragmaSchemaQuery("table_info", sTableName, sDbName);
    var stmt = this.dbConn.createStatement(sQuery);
    var aRows = [];
    try {
      while (stmt.executeStep()) {
        var oRow = {};

        oRow.cid = stmt.row.cid;
        oRow.name = stmt.row.name;
        oRow.type = stmt.row.type;
        oRow.notnull = stmt.row.notnull;
        oRow.dflt_value = stmt.row.dflt_value;
        oRow.pk = stmt.row.pk;

        aRows.push(oRow);
      }  
    } finally {
      stmt.reset();
    }
		return aRows;
  },

  getIndexList: function(sTableName, sDbName) {
		var sQuery = this.getPragmaSchemaQuery("index_list", sTableName, sDbName);
    var stmt = this.dbConn.createStatement(sQuery);
    var aRows = [];
    try {
      while (stmt.executeStep()) {
        var oRow = {};

        oRow.seq = stmt.row.seq;
        oRow.name = stmt.row.name;
        oRow.unique = stmt.row.unique;

        aRows.push(oRow);
      }  
    } finally {
      stmt.reset();
    }
		return aRows;
  },

  getIndexInfo: function(sIndexName, sDbName) {
		var sQuery = this.getPragmaSchemaQuery("index_info", sIndexName, sDbName);
    var stmt = this.dbConn.createStatement(sQuery);
    var aRows = [];
    try {
      while (stmt.executeStep()) {
        var oRow = {};

        oRow.seqno = stmt.row.seqno;
        oRow.cid = stmt.row.cid;
        oRow.name = stmt.row.name;

        aRows.push(oRow);
      }  
    } finally {
      stmt.reset();
    }
		return aRows;
  },

  getCollationList: function(sIndexName, sDbName) {
		var sQuery = "PRAGMA collation_list";
    var stmt = this.dbConn.createStatement(sQuery);
    var aRows = [];
    try {
      while (stmt.executeStep()) {
        var oRow = {};

        oRow.seq = stmt.row.seq;
        oRow.name = stmt.row.name;

        aRows.push(oRow);
      }  
    } finally {
      stmt.reset();
    }
		return aRows;
  }
}

var SQLiteFn = {
  msStrForNull: 'NULL',

	getStrForNull: function() { return this.msStrForNull;	},
	setStrForNull: function(sStrForNull) {
    this.msStrForNull = sStrForNull.toUpperCase();
	},

  quoteIdentifier: function(str) {
  //http://sqlite.org/lang_keywords.html
  //"keyword"	 	A keyword in double-quotes is an identifier
  //assume there is no " within the identifier's name
	  return '"' + str + '"';
  },

  quote: function(str) {
	  str = str.replace("'", "''", "g");
	  return "'" + str + "'";
  },

  //convert the argument into a format suitable for use in DEFAULT clause in column definition.
  makeDefaultValue: function(str) {
    if (str.length == 0)
      return null;
    else
      return str;
  },

  makeSqlValue: function(str) { 
    //for all str (typeof str == "string") seems true
    if (typeof str == "string") {
      var sUp = str.toUpperCase();
    	if (sUp == this.getStrForNull() || sUp.length == 0)
    		return this.getStrForNull();
    	if (sUp == "CURRENT_DATE" || sUp == "CURRENT_TIME" || sUp == "CURRENT_TIMESTAMP")
    		return str.toUpperCase();
      //isNaN has no problem with strings that contain valid numbers with leading/trailing spaces, hence the the following
      if ((str.indexOf(' ') == -1) && !isNaN(str))
        return Number(str);

	    return this.quote(str);
	  }
	  else
	    return str;
  },

  defaultValToInsertValue: function(str) {
    if (typeof str != "string")
      return str;
    if (str.length == 0)
      return "";
	  if (str.toUpperCase() == this.getStrForNull())
		  return "";
	  var ch = str[0];
	  if (ch != "'" && ch != '"')
      return str;

	  var newStr = "";
	  for (var i = 1; i < str.length - 1; i++) {
		  if (i >= 2)
		    if (str[i] == ch && str[i-1] == ch)
          continue;

		  newStr += str[i];
	  }
	  return newStr;
  },

  blob2hex: function(aData) {
    var hex_tab = '0123456789ABCDEF';
	  var str = '';
	  for (var i = 0; i < aData.length; i++) {
		  str += hex_tab.charAt(aData[i] >> 4 & 0xF) + hex_tab.charAt(aData[i] & 0xF);
	  }
	  return "X'" + str + "'";
  }
};

//for export purposes
function getCsvFromArray(arrData, arrTypes, arrColumns, oCsv) {
  var strDelimiter = oCsv.delimiter;
	if(oCsv.bColNames) {
		var arrRow = [], types = [];
		var i = 0;
		for(var i in arrColumns) {
		  arrRow.push(arrColumns[i][0]);
		  types.push(SQLiteTypes.TEXT);
		}
		var data = getCsvRowFromArray(arrRow, types, oCsv);
		aLines.push(data);
	}

	for(var i = 0; i < arrData.length; i++) {
		var arrRow = arrData[i];
		var types = arrTypes[i];
		var data = getCsvRowFromArray(arrRow, types, oCsv);
		aLines.push(data);
	}
  return aLines.join("\n");
}

function getCsvRowFromArray(arrRow, arrTypes, oCsv) {
  var strDelimiter = oCsv.delimiter;
  if (arrTypes == []) {
    for (var i = 0; i < arrRow.length; i++)
      arrTypes.push(SQLiteTypes.TEXT);
  }		

  for (var i = 0; i < arrRow.length; i++) {
    switch (arrTypes[i]) {
      case SQLiteTypes.INTEGER:
      case SQLiteTypes.FLOAT:
      case SQLiteTypes.BLOB:
			  break;
      case SQLiteTypes.NULL: 
			  arrRow[i] = "";
			  break;
      case SQLiteTypes.TEXT:
      default:
        arrRow[i] = arrRow[i].replace("\"", "\"\"", "g");				
        arrRow[i] = '"' + arrRow[i] + '"';
			  break;
    }
  }
  return arrRow.join(strDelimiter);
}

//arrays populated on 2009-09-13
//SQLite Core Functions
//http://sqlite.org/lang_corefunc.html
var funcNamesCore = ['abs', 'changes', 'coalesce', 'glob', 'ifnull', 'hex', 'last_insert_rowid', 'length', 'like', 'load_extension', 'lower', 'ltrim', 'max', 'min', 'quote', 'random', 'replace', 'round', 'rtrim', 'soundex', 'sqlite_source_id', 'sqlite_version', 'substr', 'total_changes', 'trim', 'typeof', 'upper', 'zeroblob'];

//SQLite Aggregate Functions
//http://sqlite.org/lang_aggfunc.html
var funcNamesAggregate = ['avg', 'count', 'group_concat', 'max', 'min', 'sum', 'total'];

//SQLite Date And Time Functions
//http://sqlite.org/lang_datefunc.html
var funcNamesDate = ['date', 'time', 'datetime', 'julianday', 'strftime'];

var funcNamesAll = [];
funcNamesAll = funcNamesAll.concat(funcNamesCore);
funcNamesAll = funcNamesAll.concat(funcNamesAggregate);
funcNamesAll = funcNamesAll.concat(funcNamesDate);

