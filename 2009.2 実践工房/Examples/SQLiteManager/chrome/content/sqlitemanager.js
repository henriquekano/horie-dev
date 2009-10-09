Components.utils.import("resource://sqlitemanager/sqlite.js");

// SQLiteManager extension
var sQuerySelectInstruction = sm_getLStr("sqlm.selectQuery");
var Database = new SQLiteHandler();
Database.setFuncConfirm(SmGlobal.confirmBeforeExecuting);

var smStructTrees = [];
smStructTrees[0] = new TreeDbStructure("t-dbStructNorm", "tc-dbStructNorm", 0);

var treeBrowse = new TreeDataTable("browse-tree");
var treeExecute = new TreeDataTable("treeSqlOutput");

var smExtManager = null;

var SQLiteManager = {
  prefs: null,

  miDbObjects: 0,
  //for display in the browse tree
  miLimit: -1,
  miOffset: 0,
  miCount: 0,

  maSortInfo: [],
  msBrowseObjName: null,
  msBrowseCondition: null,

  // Currently selected database file (nsIFile)
  sCurrentDatabase: null, 

  //an array containing names of current table, index, view and trigger
  aCurrObjNames: [],

  //to store the latest selection in tree showing db objects
  mostCurrObjName: null,
  mostCurrObjType: null,

  mbDbJustOpened: true,
  // an array of 4 arrays;
  // each holding names of tables, indexes, views and triggers
  aObjNames: [],
  aObjTypes: ["master", "table", "view", "index", "trigger"],

  clipService: null,      // Clipboard service: nsIClipboardHelper

  // Status bar: panels for displaying various info
  sbPanel: [],

  maFileExt: [],

  //the mru list which is stored in a pref
  maMruList: [],

  generateFKTriggers: function() {
  //foreign key triggers
  //http://www.sqlite.org/cvstrac/wiki?p=ForeignKeyTriggers
    var sTableName = this.aCurrObjNames["table"];
    var allRows = Database.getForeignKeyList(sTableName, "");
		if (allRows.length == 0) {
		  alert(sm_getLStr("sqlm.noForeignKey"));
		  return false;
		}

		var iId = 0;
		var aTemp = [], aFkeys = [];
		for (var i = 0; i < allRows.length; i++) {
		  fk = allRows[i];
		  if (!Database.tableExists(fk.table, "")) {
		    alert(sm_getLFStr("sqlm.fKeyNoTable",[fk.table]));
		    return false;
		  }
		  if (fk.table == sTableName) {
		    alert(sm_getLStr("sqlm.fKeySelfReference"));
		    return false;
		  }
		  if (fk.to == null) {
		    alert(sm_getLFStr("sqlm.fKeyUnnamedColumn",[fk.from]));
		    return false;
		  }
		  if (fk.id == iId) {
		    aTemp.push(fk);
		  }
		  else {
		    aFkeys.push(aTemp);
		    aTemp = [fk];
		  }
		  
		}
		if (i > 0)
      aFkeys.push(aTemp);

    var aQ = [];
    for (var i=0; i < aFkeys.length; i++) {
      var aOneKey = aFkeys[i];

      var sOnUpdate = aOneKey[0].on_update;
      var sOnDelete = aOneKey[0].on_delete;
      var sToTable = aOneKey[0].table;
      var id = aOneKey[0].id;
      var aFromCols = Database.getTableInfo(aOneKey[0].table, "");

      var sSelectColsTo = "", sSelectColsFrom = "", sWhereTo = "", sWhereFrom = "", sNullCols = "", sSetClause = "";

      for (var j=0; j < aOneKey.length; j++) {
        var oneRow = aOneKey[j];
        if (j != 0) {
          sSelectColsTo += ", ";
          sSelectColsFrom += ", ";
          sSetClause += ", ";
          sWhereTo += " AND ";
          sWhereFrom += " AND ";
        }
        sSelectColsTo += '"' + oneRow.to + '"';
        sSelectColsFrom += '"' + oneRow.from + '"';
        sWhereTo += '"' + oneRow.to + '" = NEW."' + oneRow.from + '"';
        sWhereFrom += '"' + oneRow.from + '" = OLD."' + oneRow.to + '"';
        sSetClause += '"' + oneRow.from + '" = NEW."' + oneRow.to + '"';
        //if from column is not notnull
        for (var k = 0; k < aFromCols.length; k++) {
          if (oneRow.from == aFromCols[k].name && aFromCols[k].notnull == 0) {
            sNullCols += ' NEW."' + oneRow.from + '" IS NOT NULL AND '; 
          }
        }
      }
		  //now try creating strings for trigger name, etc.
		  var sFkeyTrigPrefix = "_fk";

      //1. insert on child table
		  var insTrigName = sFkeyTrigPrefix + "_" + sTableName + "_insert_" + id;
		  var sError = "'insert on table " + sTableName + " violates foreign key constraint'";
		  aQ.push('DROP TRIGGER IF EXISTS ' + insTrigName);
		  aQ.push('CREATE TRIGGER IF NOT EXISTS ' + insTrigName + ' BEFORE INSERT ON "' + sTableName + '" FOR EACH ROW BEGIN SELECT RAISE(ROLLBACK, ' + sError + ") WHERE " + sNullCols + " (SELECT " + sSelectColsTo + ' FROM "' + sToTable + '" WHERE ' + sWhereTo + ') IS NULL; END;');

      //2. update on child table
		  var updTrigName = sFkeyTrigPrefix + "_" + sTableName + "_update_" + id;
		  var sError = "'update on table " + sTableName + " violates foreign key constraint'";
		  aQ.push('DROP TRIGGER IF EXISTS ' + updTrigName);
		  aQ.push('CREATE TRIGGER IF NOT EXISTS ' + updTrigName + ' BEFORE UPDATE ON "' + sTableName + '" FOR EACH ROW BEGIN SELECT RAISE(ROLLBACK, ' + sError + ") WHERE " + sNullCols + " (SELECT " + sSelectColsTo + ' FROM "' + sToTable + '" WHERE ' + sWhereTo + ') IS NULL; END;');

      //3. delete on parent table
		  var delTrigName = sFkeyTrigPrefix + "_" + sTableName + "_delete_" + id;
		  var sError = "'delete on table " + sToTable + " violates foreign key constraint'";
		  aQ.push('DROP TRIGGER IF EXISTS ' + delTrigName);
		  if (sOnDelete.toUpperCase() == "CASCADE") {
  		  aQ.push('CREATE TRIGGER IF NOT EXISTS ' + delTrigName + ' BEFORE DELETE ON "' + sToTable + '" FOR EACH ROW BEGIN DELETE FROM "' + sTableName + '" WHERE ' + sWhereFrom + '; END;');
		  }
		  else {
  		  aQ.push('CREATE TRIGGER IF NOT EXISTS ' + delTrigName + ' BEFORE DELETE ON "' + sToTable + '" FOR EACH ROW BEGIN SELECT RAISE(ROLLBACK, ' + sError + ') WHERE (SELECT ' + sSelectColsFrom + ' FROM "' + sTableName + '" WHERE ' + sWhereFrom + ') IS NOT NULL; END;');
      }

      //4. update on parent table
		  var updParTrigName = sFkeyTrigPrefix + "_" + sTableName + "_updateParent_" + id;
		  var sError = "'update on table " + sToTable + " violates foreign key constraint'";
		  aQ.push('DROP TRIGGER IF EXISTS ' + updParTrigName);
		  if (sOnUpdate.toUpperCase() == "CASCADE") {//after update
  		  aQ.push('CREATE TRIGGER IF NOT EXISTS ' + updParTrigName + ' AFTER UPDATE ON "' + sToTable + '" FOR EACH ROW BEGIN UPDATE "' + sTableName + '" SET ' + sSetClause + " WHERE " + sWhereFrom + '; END;');
		  }
		  else {
  		  aQ.push('CREATE TRIGGER IF NOT EXISTS ' + updParTrigName + ' BEFORE UPDATE ON "' + sToTable + '" FOR EACH ROW BEGIN SELECT RAISE(ROLLBACK, ' + sError + ') WHERE (SELECT ' + sSelectColsFrom + ' FROM "' + sTableName + '" WHERE ' + sWhereFrom + ') IS NOT NULL; END;');
      }
    }

    if (sm_confirm(sm_getLStr("sqlm.confirm.title"), sm_getLStr("sqlm.confirm.msg") + aQ.join('\n\n'))) {
      Database.executeSimpleSQLs(aQ);    
      this.refreshDbStructure();
    }
  },

  experiment: function() {
//    var sTableName = "bar";
//    this.generateFKTriggers(sTableName);
  },

  addTreeStyle: function() {
    var bFound = false;
    var ss = document.styleSheets;
    for (var iCss = 0; iCss < ss.length; iCss++) {
      if (ss[iCss].href == "chrome://sqlitemanager/skin/sqlitemanager.css") {
        bFound = true;
        break;
      }
    }
    if (!bFound)
      return;

    var objDataTreeStyle = {
      nullvalue : [["background-color", "#ffcccc", "#ff6666"]],
      integervalue : [["background-color", "#ccffcc", "#339933"]],
      floatvalue : [["background-color", "#ccffcc", "#339933"]],
      textvalue : [["background-color", "", ""]],
      blobvalue : [["background-color", "#ccccff", "#333399"]]
    };
sm_log(JSON.stringify(objDataTreeStyle));
    for (var j in objDataTreeStyle) {
      var ruleSel = 'treechildren::-moz-tree-cell(' + j + ' selected) { ';
      var rule = 'treechildren::-moz-tree-cell(' + j + ') { ';
      for(var k = 0; k < objDataTreeStyle[j].length; k++) {
        if (objDataTreeStyle[j][k][2] != "")
          ruleSel += objDataTreeStyle[j][k][0] + ": " + objDataTreeStyle[j][k][2] + "; ";
        if (objDataTreeStyle[j][k][1] != "")
          rule += objDataTreeStyle[j][k][0] + ": " + objDataTreeStyle[j][k][1] + "; ";
      }
      ruleSel += "}";
      rule += "}";

      //rule for selected should be inserted first
      ss[iCss].insertRule(ruleSel, 0);
      ss[iCss].insertRule(rule, 0);
    }
  },

  // Startup: called ONCE during the browser window "load" event
  Startup: function() {
    $$("experiment").hidden = true;

    smUDF.initFunctionDb();

    this.addTreeStyle();
    //create the menus by associating appropriate popups
    this.createMenu();

    //initialize the structure tree
 		smStructTrees[0].init();

    this.refreshDbStructure();

    treeBrowse.init();
    treeExecute.init();

    var mi = $$("menu-general-sharedPagerCache");

    this.showMruList();

    // Load clipboard service
    this.clipService = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);

    //get the nodes for Status bar panels
    this.sbPanel["display"] = $$("sbPanel-display");
    //global var in globals.js for sbpanel[display]
    gSbPanelDisplay = this.sbPanel["display"];

    $$("sbExtVersion").setAttribute("label", gExtVersion);

    //display Gecko version in the status bar
    var sbGeckoVersion = $$("sbGeckoVersion");
    sbGeckoVersion.setAttribute("label","Gecko " + gAppInfo.platformVersion);

		$$("vb-structureTab").hidden = true;
		$$("vb-browseTab").hidden = true;
		$$("vb-executeTab").hidden = true;
		$$("vb-dbInfoTab").hidden = true;

    //preferences service to add oberver
    // and then observe changes via the observe function
    //see http://developer.mozilla.org/en/docs/Adding_preferences_to_an_extension
    //initialize the preference service with the correct branch
    this.prefs = sm_prefsBranch;
    //query interface to be able to use addObserver method
    this.prefs.QueryInterface(Ci.nsIPrefBranch2);
    //now, add the observer which will be implemented using observe method
    //calling removeObserver when done with observing helps the memory
    this.prefs.addObserver("", this, false);

    var iNumRecords = sm_prefsBranch.getIntPref("displayNumRecords");
    if (iNumRecords == -1)
      sm_prefsBranch.setIntPref("displayNumRecords", 100);

    //To set our variables, etc. we fool observe into believing that the following preferences have changed.
    for(var i = 0; i < smObservedPrefs.length; i++)
      this.observe("", "nsPref:changed", smObservedPrefs[i]);

    // opening with last used DB if preferences set to do so
    var bPrefVal = sm_prefsBranch.getBoolPref("openWithLastDb");
		if(bPrefVal) {
			var sPath = this.getMruLatest();
			if(sPath != null) {
				//Last used DB found, open this DB
				var newfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
				newfile.initWithPath(sPath);
				//if the last used file is not found, bail out
				if(!newfile.exists()) {
					smPrompt.alert(null, sm_getLStr("extName"), sm_getLFStr("lastDbDoesNotExist",[sPath]));
				  return;
				}
				bPrefVal = sm_prefsBranch.getBoolPref("promptForLastDb");
				if(bPrefVal) {
					var check = {value: false}; // default the checkbox to false
					var result = smPrompt.confirmCheck(null, sm_getLStr("extName") + " - " + sm_getLStr("promptLastDbTitle"), sm_getLStr("promptLastDbAsk")+ "\n" + sPath + "?", sm_getLStr("promptLastDbOpen"), check);

					if(!result)
						return;
					//update the promptForLastDb preference
					bPrefVal = sm_prefsBranch.setBoolPref("promptForLastDb", !check.value);
				}
				//assign the new file (nsIFile) to the current database
				this.sCurrentDatabase = newfile;
				this.setDatabase(this.sCurrentDatabase);
			}
		}
		//load the previously opened tab
    this.loadTabWithId(this.getSelectedTabId());
		return;
  },

  // Shutdown: called ONCE during the browser window "unload" event
  Shutdown: function() {
    //close the current database
    this.closeDatabase(false);
    //Destruction - this should be fired once you're done observing
    //Failure to do so may result in memory leaks.	
    this.prefs.removeObserver("", this);

    this.clipService= null;
  },  

	createMenu: function() {
		var suffixes = ["table", "index", "view", "trigger"];

	  var mpdb = $$("mp-dbstructure");
		for(var i = 0; i < suffixes.length; i++) {
		  var suffix = suffixes[i];
		  var mp = $$("menu-" + suffix);
		  var ch = mp.querySelector('menupopup').childNodes;
      for (var c = 0; c < ch.length; c++) {
  		  var clone = ch[c].cloneNode(true);
  		  clone.setAttribute("smType", suffix);
        mpdb.appendChild(clone);
      }
		  var mp = $$("mp-create-" + suffix);
		  var ch = mp.childNodes;
      for (var c = 0; c < ch.length; c++) {
  		  var clone = ch[c].cloneNode(true);
  		  clone.setAttribute("smType", "create-" + suffix);
        mpdb.appendChild(clone);
      }
		}
	},

	changeDbSetting: function(sSetting) {
	  if (sSetting == "schema_version") {
      var bConfirm = sm_confirm(sm_getLStr("dangerous.op"), sm_getLStr("confirm.changeSchemaVersion") + "\n\n" + sm_getLStr("q.proceed"));
      if (!bConfirm)
        return false;
	  }
		var node = $$("pr-" + sSetting);
		var sVal = node.value;
		var newVal = Database.setSetting(sSetting, sVal);
		node.value = newVal;

		var sMessage = sm_getLFStr("pragma.changed", [sSetting, newVal]);
		sm_notify("boxNotifyDbInfo", sMessage, "info", 4);
	},

	setTreeStructureContextMenu: function() {
		var tree = $$(smStructTrees[this.miDbObjects].treeId);
		var idx = tree.currentIndex;
		// idx = -1 if nothing is selected; says xulplanet element reference
		if(idx == -1)
			idx = 0;
		var objName = tree.view.getCellText(idx, tree.columns.getColumnAt(0));
		var level = tree.view.getLevel(idx);
 		var info = smStructTrees[this.miDbObjects].getSmType(idx);

		//there is a database object at level 1 only
		var mpId = "";
		if (level == 0) {
  		if(info.indexOf("all-") == 0) {
        info = info.substring("all-".length).toLowerCase();
  			if (this.aObjTypes.indexOf(info) > 0) //thus omit master
          mpId = "create-" + info;
			}
		}	
		if (level == 1) {
 			if (this.aObjTypes.indexOf(info) != -1)
   	    mpId = info;
    }
	  var mpdb = $$("mp-dbstructure");
	  var ch = mpdb.childNodes;
		for(var i = 0; i < ch.length; i++) {
		  var suffix = ch[i].getAttribute("smType");
		  if (suffix == mpId)
		    ch[i].hidden = false;
      else
		    ch[i].hidden = true;
		}
  },

  setMruList: function(sPath) {
    var iMruSize = sm_prefsBranch.getIntPref("mruSize");
    var aNewList = [];
    var aPrefList = [];

    var fDir = Cc["@mozilla.org/file/directory_service;1"]
            .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    if (sPath.indexOf(fDir.path) == 0) {
      var sRelPath = "[ProfD]" + sPath.substring(fDir.path.length);
      aNewList.push(sRelPath);
    } else {
      aNewList.push(sPath);
    }

    for (var i = 0; i < this.maMruList.length; i++) {
      if (this.getMruFullPath(this.maMruList[i]) != sPath)
        aNewList.push(this.maMruList[i]);

      if (aNewList.length >= iMruSize)
        break;
    }
    this.maMruList = aNewList;

    sm_setUnicodePref("mruPath.1", this.maMruList.join(","));
    this.showMruList();
  },

  removeFromMru: function(sPath) {
    for (var i = 0; i < this.maMruList.length; i++) {
      if (this.getMruFullPath(this.maMruList[i]) == sPath) {
        this.maMruList.splice(i, 1);
        sm_setUnicodePref("mruPath.1", this.maMruList.join(","));
        this.showMruList();
        return true;
      }
    }
    return false;
  },

  getMruLatest: function() {
    var sMru = sm_prefsBranch.getComplexValue("mruPath.1", Ci.nsISupportsString).data;
    this.maMruList = sMru.split(",");
    if (this.maMruList.length > 0)
      return this.getMruFullPath(this.maMruList[0]);
    else
      return null;
  },

  getMruFullPath: function(sMruVal) {
    var sRelConst = "[ProfD]";
    var fDir = Cc["@mozilla.org/file/directory_service;1"]
            .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);

    var sFullPath = sMruVal;
    if (sFullPath.indexOf(sRelConst) == 0)
      sFullPath = fDir.path + sFullPath.substring(sRelConst.length);

    return sFullPath;
  },

  showMruList: function() {
    this.getMruLatest();

    var menupopupNode = $$("menu-mru").firstChild;
    ClearElement(menupopupNode);
    for (var i = 0; i < this.maMruList.length; i++) {
      var sFullPath = this.getMruFullPath(this.maMruList[i])

		  var mp = $$("mi-mru");
		  var mi = mp.cloneNode(true);
		  mi.setAttribute("id", "mi-mru-" + i);
  	  mi.setAttribute("label", sFullPath);
  	  mi.removeAttribute("hidden");
      menupopupNode.appendChild(mi);
    }
  },

	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed")
			return;
		
		switch(data) {
			case "hideMainToolbar":
				var bPrefVal = sm_prefsBranch.getBoolPref("hideMainToolbar");
				$$("hbox-main-toolbar").hidden = bPrefVal;
				break;
			case "showMainToolbarDatabase":
				var bPrefVal = sm_prefsBranch.getBoolPref("showMainToolbarDatabase");
				$$("sm-toolbar-database").hidden = !bPrefVal;
				break;
			case "showMainToolbarTable":
				var bPrefVal = sm_prefsBranch.getBoolPref("showMainToolbarTable");
				$$("sm-toolbar-table").hidden = !bPrefVal;
				break;
			case "showMainToolbarIndex":
				var bPrefVal = sm_prefsBranch.getBoolPref("showMainToolbarIndex");
				$$("sm-toolbar-index").hidden = !bPrefVal;
				break;
			case "showMainToolbarDebug":
				var bPrefVal = sm_prefsBranch.getBoolPref("showMainToolbarDebug");
				$$("sm-toolbar-debug").hidden = !bPrefVal;
				break;
			case "sqliteFileExtensions":
				var sExt = sm_prefsBranch.getCharPref("sqliteFileExtensions");
				this.maFileExt = sExt.split(",");
				for (var iC = 0; iC < this.maFileExt.length; iC++) {
				  this.maFileExt[iC] = this.maFileExt[iC].trim();
				  //replace(/^\s+/g, '').replace(/\s+$/g, '');
				}
        // Load profile folder's sqlite db files list into dropdown 
				this.populateDBList("profile");   
				break;
			case "searchToggler":
        //Issue #285: get unicode string
				var sPrefVal = sm_prefsBranch.getComplexValue("searchCriteria", Ci.nsISupportsString).data;
				this.msBrowseCondition = sPrefVal;
				//because search criteria has changed, set offset for navigating to zero
				this.miOffset = 0;
				//empty the criteria after use for security
				sm_prefsBranch.setCharPref("searchCriteria", "");
				this.loadTabBrowse();
				break;
			case "displayNumRecords":
				var iPrefVal = sm_prefsBranch.getIntPref("displayNumRecords");
				this.miLimit = iPrefVal;
				if (this.miLimit == 0) this.miLimit = -1;
				this.miOffset = 0;
				break;
			case "textForBlob":
			case "showBlobSize":
			case "maxSizeToShowBlobData":
				var sStrForBlob = sm_prefsBranch.getCharPref("textForBlob");
				var bShowBlobSize = sm_prefsBranch.getBoolPref("showBlobSize");
				var iMaxSizeToShowBlobData = sm_prefsBranch.getIntPref("maxSizeToShowBlobData");
				Database.setBlobPrefs(sStrForBlob, bShowBlobSize, iMaxSizeToShowBlobData);
				break;
			case "handleADS": //for ADS on Windows/NTFS
        $$("mi-connect-ads-win").hidden = true;
        if (navigator.oscpu.indexOf("Windows") >= 0) {
          var iPrefVal = sm_prefsBranch.getIntPref("handleADS");
          if (iPrefVal == 1)
            $$("mi-connect-ads-win").hidden = false;
        }
        break;
			case "posInTargetApp":
      var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
      if(appInfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}") {
        var md = window.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIWebNavigation)
          .QueryInterface(Ci.nsIDocShellTreeItem).rootTreeItem
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow).document;
        var iVal = sm_prefsBranch.getIntPref("posInTargetApp");
        var mi = md.getElementById("menuitem-sqlitemanager");
        if (mi) {
          if (iVal == 0)
            mi.setAttribute("hidden", true);
          if (iVal == 1)
            mi.setAttribute("hidden", false);
        }
      }
    }
  },

  refresh: function() {
    if (this.sCurrentDatabase == null)
    	return false;
    this.refreshDbStructure();
    return true; 
  },
  //Issue #108
  reconnect: function() {
    var nsFile = this.sCurrentDatabase;
    this.closeDatabase(false);

    this.sCurrentDatabase = nsFile;
    this.setDatabase(this.sCurrentDatabase);  
  },

  //refreshDbStructure: populates the schematree based on selected database
  //must be called whenever a database is opened/closed
  //and whenever the schema changes
  refreshDbStructure: function() {
    //1. if no database is selected
    if (this.sCurrentDatabase == null) {
  		smStructTrees[0].removeChildData();

  		for(var i = 0; i < this.aObjTypes.length; i++) {
  			var type = this.aObjTypes[i];
  			this.aCurrObjNames[type] = null;
  		}
  		return;
  	}

    //2. if db is being opened, set nodes to expand
    if (this.mbDbJustOpened) {
      //set the expandable nodes here
      var aExpand = [["all-table"],[]];
  		//check whether aExpand data is in smextmgmt table and use it
		  if (smExtManager.getUsage()) {
		    aExpand = smExtManager.getStructTreeState();
		  }
	    smStructTrees[0].setExpandableNodes(aExpand);
    }

    //3. 
    var tree = $$(smStructTrees[this.miDbObjects].treeId);

		//requery for all the objects afresh and redraw the tree
    for (var iC = 0; iC < this.aObjTypes.length; iC++) {
      var sType = this.aObjTypes[iC];
      this.aObjNames[sType] = Database.getObjectList(sType, "");
    }

		var idx = tree.currentIndex;
    smStructTrees[this.miDbObjects].setChildData(this.aObjNames);

    if (idx >= smStructTrees[this.miDbObjects].visibleDataLength)
      idx = 0;

		tree.view.selection.select(idx); //triggers getDbObjectInfo function
		
		//now assign the current objects
		for(var i = 0; i < this.aObjTypes.length; i++) {
			var type = this.aObjTypes[i];
			if(this.aObjNames[type].length > 0) {
				var bFound = false;
				if(this.aCurrObjNames[type]) {
					for(var n = 0; n < this.aObjNames[type].length; n++) {
						if(this.aCurrObjNames[type] == this.aObjNames[type][n]) {
							bFound = true;
							break;
						}
					}
				}
				if(!bFound)
					this.aCurrObjNames[type] = this.aObjNames[type][0];
			}
			else
				this.aCurrObjNames[type] = null;
		}
  },
		 		 
	//getDbObjectInfo: this function must show the structural info about the
	// selected database object (table, index, view & trigger)
	//this function is triggered by the select event on the tree
  getDbObjectInfo: function() {
    var tree = $$(smStructTrees[this.miDbObjects].treeId);
		var idx = tree.currentIndex;

		// idx = -1 if nothing is selected; says xulplanet element reference
		if(idx < 0 || idx >= tree.view.rowCount)
			idx = 1; //first table

		var level = tree.view.getLevel(idx);

		//there is a database object at level 1 only
		if(level == 0) {
			this.mostCurrObjName = null;
			this.mostCurrObjType = null;
			return false;
		}
		//level 2 is a field name of the parent table
		if(level == 2) {
		  idx = tree.view.getParentIndex(idx);
		}	
		var r_name = tree.view.getCellText(idx, tree.columns.getColumnAt(0));
    var r_type = smStructTrees[this.miDbObjects].getSmType(idx);
			
		//assign current selection in tree as current object
		this.aCurrObjNames[r_type] = r_name;

		this.mostCurrObjName = r_name;
		this.mostCurrObjType = r_type;

		this.loadTabStructure();
		this.loadTabBrowse();

		return true;
  },

  hideTabStructure: function() {
		//hide the hboxes containing object specific operation buttons
		//later enable one appropriate hbox according to the selection in tree
		$$("d-master-ops").hidden = true;
    $$("d-more-info").hidden = true;
    //hide other things
		$$("gb-master-info").hidden = true;
  },

  emptyTabStructure: function() {
		//hide the hboxes containing object specific operation buttons
		//later enable one appropriate hbox according to the selection in tree
		this.hideTabStructure();

		$$("str-sql").value = "";

    this.printTableInfo(null, "table");
  },

  loadTabStructure: function() {
    //no need to waste resources if this tab is not selected
    if(this.getSelectedTabId() != "tab-structure")
    	return false;
    	
    this.hideTabStructure();
    this.cancelEditColumn();

    if (this.sCurrentDatabase == null)
    	return false;

		//there is a database object at level 1 only
		if(this.mostCurrObjName == null) {
			return false;
		}	
		
		var r_name = this.mostCurrObjName;
		var r_type = this.mostCurrObjType;

	  $$("d-master-ops").hidden = false;
	  $$("d-master-ops").selectedPanel = $$("gb-master-ops-" + r_type);

    if (r_name == "sqlite_master" || r_name == "sqlite_temp_master") {
      $$("cap-object-info").label = 'TABLE' + ': ' + r_name;
    }
    else {
      var row = Database.getMasterInfo(r_name, '');

      $$("cap-object-info").label = row.type.toUpperCase() + ': ' + row.name;
      if (row.sql != null) {
    		$$("gb-master-info").hidden = false;
        $$("str-sql").value = row.sql;
		    var iRowsSql = $$("str-sql").value.split('\n').length;
		    iRowsSql = (iRowsSql > 5)?iRowsSql:5;
        $$("str-sql").setAttribute("rows", iRowsSql);
        if (row.type == 'trigger' || row.type == 'view') {
		      iRowsSql = (iRowsSql > 13)?iRowsSql:13;
          $$("str-sql").setAttribute("rows", iRowsSql);
        }
      }
    }
		//do the following for table/index
		if(r_type == "table" || r_type == "master") {
			this.printTableInfo(this.aCurrObjNames[r_type], r_type);
		}
		if(r_type == "index") {
			this.printIndexInfo(this.aCurrObjNames[r_type]);
		}
		return true;
  },

  printTableInfo: function(sTable, sType) {
    if (this.miDbObjects == 1) //no add column option for master tables
      sType = "master";

	  $$("d-more-info").hidden = false;
	  $$("d-more-info").selectedPanel = $$("gb-more-info-table");

		ClearElement($$("smTableColumns"));
    if (sTable == null)
      return;

////////////////////////////////////
    if (Database.getOpenStatus() != "Exclusive") {
//      $$("treeTabCols").datasources = "file://" + Database.getFile().path;
//      $$("qPragmaTable").textContent = "PRAGMA table_info('" + sTable + "')";
//      $$("treeTabCols").builder.rebuild();
    }

////////////////////////////////////
    $$("hb-addcol").hidden = false;
    $$("mp-opTableColumn").hidden = false;
    if (sTable.indexOf("sqlite_") == 0) {
      //no add/edit/drop column for master tables
      $$("hb-addcol").hidden = true;
      $$("mp-opTableColumn").hidden = true;
     }

    $$("treeTabCols").setAttribute("smTableName", sTable);
		var cols = Database.getTableInfo(sTable, "");
//		var iRows = (cols.length>=6)?6:(cols.length+1);
//		$$("treeTabCols").setAttribute("rows", iRows);
    $$("capColumns").label = $$("capColumns").getAttribute("labelPrefix") + " (" + cols.length + ")";
		ClearElement($$("smTableColumns"));
		var hhh = '';
		for(var i = 0; i < cols.length; i++) {
/* the following is useful with jquery
		  hhh += '<treeitem><treerow>';
		  hhh += '<treecell label="' + cols[i].cid + '"/>';
		  hhh += '<treecell label="' + cols[i].name + '"/>';
		  hhh += '<treecell label="' + cols[i].type + '"/>';
		  hhh += '<treecell label="' + cols[i].notnull + '"/>';
		  hhh += '<treecell label="' + cols[i].dflt_value + '"/>';
		  hhh += '<treecell label="' + cols[i].pk + '"/>';
		  hhh += '</treerow/></treeitem>';
*/
			var trow = document.createElement("treerow");

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].cid);
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].name);
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].type);
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].notnull);
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].dflt_value);
			if (cols[i].dflt_value == null)
			  tcell.setAttribute("class", "nullvalue");
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].pk);
			trow.appendChild(tcell);

			var titem = document.createElement("treeitem");
			titem.appendChild(trow);
			$$("smTableColumns").appendChild(titem);
		}

    var aObj = Database.getObjectCount(sTable, "");
		$$("numRecords").value = Database.getRowCount(sTable, "");
		$$("numIndexes").value = aObj.indexCount;
		$$("numTriggers").value = aObj.triggerCount;
  },

  printIndexInfo: function(sIndex) {
	  $$("d-more-info").hidden = false;
	  $$("d-more-info").selectedPanel = $$("gb-more-info-index");

		var aIndexInfo = Database.getIndexDetails(sIndex, '');
		$$("tabletoindex").value = aIndexInfo.tbl_name;
		$$("duplicatevalues").value = sm_getLStr("allowed");
		if(aIndexInfo.unique == 1)
			$$("duplicatevalues").value = sm_getLStr("notAllowed");

		var cols = Database.getIndexInfo(sIndex, "");

		ClearElement($$("smIndexColumns"));
		for(var i = 0; i < cols.length; i++) {
			var trow = document.createElement("treerow");

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].seqno);
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].cid);
			trow.appendChild(tcell);

			var tcell = document.createElement("treecell");
			tcell.setAttribute("label", cols[i].name);
			trow.appendChild(tcell);

			var titem = document.createElement("treeitem");
			titem.appendChild(trow);
			$$("smIndexColumns").appendChild(titem);
		}
  },

  changeSortOrder: function(ev) {
    if (ev.button==2) //right click
      return;
    var tgt = ev.target
    var sColName = tgt.getAttribute("label");
    var bFound = false;
    for(var i = 0; i < this.maSortInfo.length; i++) {
      if (this.maSortInfo[i][0] == sColName) {
        bFound = true;
        switch (this.maSortInfo[i][1]) {
          case "none":
            this.maSortInfo[i][1] = "asc";
            break;
          case "asc":
            this.maSortInfo[i][1] = "desc";
            break;
          case "desc":
            this.maSortInfo[i][1] = "none";
            break;
        }
        var aTemp = this.maSortInfo[i];
        this.maSortInfo.splice(i, 1);

        if (aTemp[1] != "none")
          this.maSortInfo.splice(0, 0, aTemp);
      }
    }
    if (!bFound)
      this.maSortInfo.splice(0, 0, [sColName, "asc"]);
    this.loadTabBrowse();
  },

	//loadTabBrowse: populates the table list and the tree view for current table; must be called whenever a database is opened/closed and whenever the schema changes; depends entirely upon the values in "browse-type" and "browse-name" controls
  loadTabBrowse: function() {
    //no need to waste resources if this tab is not selected
    if(this.getSelectedTabId() != "tab-browse")
    	return false;
    	
    if (this.sCurrentDatabase == null)
    	return false;

		if (this.mostCurrObjType == null)
			return false;

		var sObjType = this.mostCurrObjType.toLowerCase();
		if (sObjType != "table" && sObjType != "master" && sObjType != "view")
			return false;

		$$("browse-type").value = sObjType.toUpperCase();
		if ($$("browse-name").value != this.mostCurrObjName)
		  this.maSortInfo = [];

		$$("browse-name").value = this.mostCurrObjName;

		//populate the treeview
    var sObjName = this.mostCurrObjName;
		if (sObjName != this.msBrowseObjName) {
			this.miOffset = 0;
			this.msBrowseObjName = sObjName;
			this.msBrowseCondition = "";
		}

		//some UI depends on whether table/master tables/view is shown
		var btnAdd =	$$("btnAddRecord");
		var btnDup =	$$("btnAddDupRecord");
		var btnEdit =	$$("btnEditRecord");
		var btnDelete =	$$("btnDeleteRecord");

		var treeChildren = $$("browse-treechildren");

    var setting = [false, "mp-editTableRow", "SQLiteManager.operateOnTable('update')"];
		if (sObjType == "table" && (this.mostCurrObjName == "sqlite_master" || this.mostCurrObjName == "sqlite_temp_master")) {
      setting = [true, "mp-browse-copy", ""];
		}
		if (sObjType == "master") {
      setting = [true, "mp-browse-copy", ""];
		}
		if (sObjType == "view") {
      setting = [true, "mp-browse-copy", ""];
		}

		btnAdd.disabled = setting[0];
		btnDup.disabled = setting[0];
		btnEdit.disabled = setting[0];
		btnDelete.disabled = setting[0];
		treeChildren.setAttribute("context", setting[1]);
		treeChildren.setAttribute("ondblclick", setting[2]);

    treeBrowse.ShowTable(false);

    try {
      var aArgs = {sWhere: this.msBrowseCondition, iLimit: this.miLimit, iOffset: this.miOffset, aOrder: this.maSortInfo};
      var iRetVal = Database.loadTableData(sObjType, sObjName, aArgs);
      var timeElapsed = Database.getElapsedTime();
    } catch (e) { 
      sm_message(e + "\n" + sm_getLStr("loadDataFailed"), 0x3);
			return false;
    }
    if (iRetVal == -1)
    	return false;

    var records = Database.getRecords();
    var types = Database.getRecordTypes();
    var columns = Database.getColumns();
  	this.miCount = Database.getRowCount(sObjName, this.msBrowseCondition);
	  $$("sbQueryTime").label = "ET: " + timeElapsed;

		this.manageNavigationControls();    	
    if (records && columns) {
      $$("browse-tree").setAttribute("smObjType", sObjType);
      $$("browse-tree").setAttribute("smObjName", sObjName);
      treeBrowse.createColumns(columns, iRetVal, this.maSortInfo, "SQLiteManager.changeSortOrder(event);");
      var jsonColInfo = smExtManager.getBrowseTreeColState(sObjType, sObjName);
      if (jsonColInfo != "") {
        var objColInfo = JSON.parse(jsonColInfo);
        treeBrowse.adjustColumns(objColInfo);
      }
      treeBrowse.PopulateTableData(records, columns, types);
    }
		return true;
  },

	onBrowseNavigate: function(sType) {
		switch(sType) {
			case "first":
				this.miOffset = 0;
				break;
			case "previous":
				this.miOffset = this.miOffset - this.miLimit;
				if (this.miOffset < 0)
					this.miOffset = 0;
				break;
			case "next":
				this.miOffset = this.miOffset + this.miLimit;
				break;
			case "last":
				this.miOffset = this.miCount - (this.miCount % this.miLimit);
				break;
		}
		this.loadTabBrowse();
	},

	manageNavigationControls: function() {
		//manage textboxes
  	$$("nav-total-val").value = this.miCount;
  	var iStart = (this.miCount == 0) ? 0 : (this.miOffset + 1);
  	$$("nav-start-val").value = iStart;
  	var iEnd = this.miOffset + this.miLimit;
  	iEnd = ((iEnd > this.miCount) || (this.miLimit <= 0)) ? this.miCount : iEnd;
  	$$("nav-end-val").value = iEnd;

		//manage buttons
		var btnFirst = $$("btn-nav-first");
		var btnPrevious = $$("btn-nav-previous");
		var btnNext = $$("btn-nav-next");
		var btnLast = $$("btn-nav-last");

		btnFirst.disabled = false;
		btnPrevious.disabled = false;
		btnNext.disabled = false;
		btnLast.disabled = false;

    //manage the navigate buttons
    if (this.miLimit < 0 || this.miLimit >= this.miCount) {
			btnFirst.disabled = true;
			btnPrevious.disabled = true;
			btnNext.disabled = true;
			btnLast.disabled = true;
			return;
    }

		if (this.miOffset == 0) {
			btnFirst.disabled = true;
			btnPrevious.disabled = true;
		}
		else {
			btnFirst.disabled = false;
			btnPrevious.disabled = false;
		}
		if (this.miOffset + this.miLimit > this.miCount) {
			btnNext.disabled = true;
			btnLast.disabled = true;
		}
		else {
			btnNext.disabled = false;
			btnLast.disabled = false;
		}
	},

	//loadTabExecute: anything to be done when that tab is shown goes here
  loadTabExecute: function() {
    this.populateQueryListbox();
  },

	//loadTabDbInfo: anything to be done when that tab is shown goes here
  loadTabDbInfo: function() {
    //no need to waste resources if this tab is not selected
    if(this.getSelectedTabId() != "tab-dbinfo")
    	return false;

    if (this.sCurrentDatabase == null)
    	return false;

	  aSettings = ["schema_version", "user_version", "auto_vacuum", "cache_size", /*"case_sensitive_like",*/ "count_changes", "default_cache_size", "empty_result_callbacks", "encoding", "full_column_names", "fullfsync", "journal_mode", "journal_size_limit", "legacy_file_format", "locking_mode", "page_size", "max_page_count", "page_count", "freelist_count", "read_uncommitted", "short_column_names", "synchronous", "temp_store", "temp_store_directory"];
		for(var i = 0; i < aSettings.length; i++)	{
		  var sSetting = aSettings[i];
			var node = $$("pr-" + sSetting);
			var newVal = Database.getSetting(sSetting);
			node.value = newVal;
		}
		return true;
	},

  search: function() {
		var oType = $$("browse-type").value.toUpperCase();
    var oName = $$("browse-name").value;
    if (oType == "VIEW")
      return this.searchView(oName);
    if (oType == "TABLE" || oType == "MASTER") {
      window.openDialog("chrome://sqlitemanager/content/RowOperations.xul", "RowOperations", "chrome, resizable, centerscreen, modal, dialog", Database, oName, "search");
  		return true;
  	}
  },

  searchView1: function(sViewName) {
    var aArgs = {sWhere: "", iLimit: 1, iOffset: 0};
  	Database.loadTableData("view", sViewName, aArgs);
    var records = Database.getRecords();
    if (records.length == 0) {
    	alert(sm_getLStr("noRecord"));
    	return false;
    }

		var columns = Database.getColumns();
  	var names = [], types = [];
    for (var col in columns) {
    	names[col] = columns[col][0];
    	types[col] = '';
    }
    var aColumns = [names, types];
    
		this.aFieldNames = aColumns[0];
		var aTypes = aColumns[1];

		var grbox = $$("hb-sliding");
		ClearElement(grbox);
//    		var cap = document.createElement("caption");
//    		cap.setAttribute("label", "Enter Field Values");
//    		grbox.appendChild(cap);

		for(var i = 0; i < this.aFieldNames.length; i++) {
			var hbox = document.createElement("hbox");
			hbox.setAttribute("flex", "1");
			hbox.setAttribute("style", "margin:2px 3px 2px 3px");

			var lbl = document.createElement("label");
			var lblVal = (i+1) + ". " + this.aFieldNames[i];
			lblVal += " ( " + aTypes[i] + " )"; 
			lbl.setAttribute("value", lblVal);
			lbl.setAttribute("style", "padding-top:5px;width:25ex");
			lbl.setAttribute("accesskey", (i+1));
			lbl.setAttribute("control", "ctrl-" + this.aFieldNames[i]);
			hbox.appendChild(lbl);

			var spacer = document.createElement("spacer");
			spacer.flex = "1";
			hbox.appendChild(spacer);

			var vb = RowOperations.getSearchMenuList(this.aFieldNames[i]);
			hbox.appendChild(vb);

			var inp = RowOperations.getInputField(i);
			hbox.appendChild(inp);

			var vb = RowOperations.getInputToggleImage(i);
			hbox.appendChild(vb);

			grbox.appendChild(hbox);
		}
    return true;
  },

  searchView: function(sViewName) {
    var aArgs = {sWhere: "", iLimit: 1, iOffset: 0};
  	Database.loadTableData("view", sViewName, aArgs);
    var records = Database.getRecords();
    if (records.length == 0) {
    	alert(sm_getLStr("noRecord"));
    	return false;
    }

		var columns = Database.getColumns();
  	var names = [], types = [];
    for (var col in columns) {
    	names[col] = columns[col][0];
    	types[col] = '';
    }
    var cols = [names, types];
    window.openDialog("chrome://sqlitemanager/content/RowOperations.xul",	"RowOperations", "chrome, resizable, centerscreen, modal, dialog", Database, sViewName, "search-view", cols);
    return true;
  },

  showAll: function() {
		sm_prefsBranch.setCharPref("searchCriteria", "");

		//the value of searchToggler should toggle for change event to fire.
		var bTemp = sm_prefsBranch.getBoolPref("searchToggler");
		sm_prefsBranch.setBoolPref("searchToggler", !bTemp);
  },

  //getSelectedTabId: returns the id of the selected tab
  getSelectedTabId: function() {
		return $$("sm-tabs").selectedItem.id;
  },

  //selectStructTab: called when onselect event fires on tabs[id="sm-tabs-db"]
	selectStructTab: function(oSelectedTab) {
		var id = oSelectedTab.getAttribute("id");
		switch(id) {
			case "tab-db-norm":
				this.miDbObjects = 0;
				break;
		}
		this.refreshDbStructure();
		return true;
	},

	loadTabWithId: function(sId) {
		switch(sId) {
			case "tab-structure":
				this.loadTabStructure();
				break;
			case "tab-browse":
				this.loadTabBrowse();
				break;
			case "tab-execute":
				this.loadTabExecute();
				break;
			case "tab-dbinfo":
				this.loadTabDbInfo();
				break;
			case "tab-exim":
//				this.loadTabExim();
				break;
		}
		return true;
	},

  closeTab: function() {
    var sId = $$("sm-tabs").selectedItem.id;
		switch(sId) {
			case "tab-structure":
			case "tab-browse":
			case "tab-execute":
			case "tab-dbinfo":
				break;
			case "tab-exim":
        SmExim.exitExim();
				break;
		}
		return true;
  },

  //bImplicit: false = called from menuitem; true = function call
  useExtensionManagementTable: function(bUse, bImplicit) {
    var mi = $$("menu-general-extensionTable");

		if(this.sCurrentDatabase == null) {
		  //revert to the state before clicking
      mi.removeAttribute("checked");
			if (!bImplicit) alert(sm_getLStr("firstOpenADb"));
			return false;
		}

    smExtManager.setUsage(bUse, bImplicit);
    if (bUse) {
      mi.setAttribute("checked", "true");
      this.populateQueryListbox();
    }
    else
      mi.removeAttribute("checked");

		//refresh the structure tree here so that mgmt table is shown/removed
		this.refresh();

		//hide/show the images for query history in the execute sql tab
		$$("queryHistoryPrevImage").hidden = !bUse;
		$$("queryHistoryNextImage").hidden = !bUse;
		$$("querySaveByNameImage").hidden = !bUse;
		$$("queryHistoryClearImage").hidden = !bUse;

		$$("listbox-queries").hidden = !bUse;

    return true;
  },

  showPrevSql: function() {
    var sQuery = smExtManager.getPrevSql();
    if (!sQuery) return;
    $$("txtSqlStatement").value = sQuery;
  },

  showNextSql: function() {
    var sQuery = smExtManager.getNextSql();
    if (!sQuery) return;
    $$("txtSqlStatement").value = sQuery;
  },

	saveSqlByName: function()	{
		var sQuery = $$("txtSqlStatement").value;
		if (sQuery.length <= 0)
			alert(sm_getLStr("sqlm.nothingToSave"));

    if (smExtManager.saveSqlByName(sQuery))
      this.populateQueryListbox();
	},

  clearSqlHistory: function() {
    smExtManager.clearSqlHistory();
  },

	onSelectQuery: function() {
    var sVal = $$("listbox-queries").value;
    if (sVal != sQuerySelectInstruction)
  		$$("txtSqlStatement").value = sVal;
	},

	populateQueryListbox: function() {
		var listbox = $$("listbox-queries");
    if (this.sCurrentDatabase == null) {
      listbox.hidden = true;
    	return false;
    }
		var aQueries = smExtManager.getQueryList();
		if (aQueries.length)
		  aQueries.unshift(sQuerySelectInstruction);
		else
		  aQueries = [sQuerySelectInstruction];
		var sDefault = listbox.selectedItem;
		if (sDefault != null)
      sDefault = sDefault.label;
		PopulateDropDownItems(aQueries, listbox, sDefault);
	},

	runSqlStatement: function(sType) {
		if(this.sCurrentDatabase == null)	{
			alert(sm_getLStr("firstOpenADb"));
			return;
		}

		//get the query string from an xul page
		var sQuery = $$("txtSqlStatement").value;
		
		var queries = sql_tokenizer(sQuery);
    if (queries.length == 0) {
			alert(sm_getLStr("writeSomeSql"));
			return;
		}
		var aData, aColumns, aTypes;
    var timeElapsed = 0;
    var bRet = false;
//		if(sType == "select")
    if (queries.length == 1) {
      sQuery = queries[0];
			bRet = Database.selectQuery(sQuery);
			timeElapsed = Database.getElapsedTime();
      //store the query in config db
			if (bRet) {
    		aData = Database.getRecords();
    		aColumns = Database.getColumns();
        aTypes = Database.getRecordTypes();
   		  sm_message(sm_getLFStr("rowsReturned", [aData.length]), 0x2);
        smExtManager.addQuery(sQuery);
      }
      //set this value so that query history is reset to latest query
      //that is previous will again begin from the latest query
  		smExtManager.goToLastQuery();
		}
		else {
			bRet = Database.executeTransaction(queries);
			timeElapsed = Database.getElapsedTime();
		}
		
		//display the last error in the textbox
		$$("sqlLastError").value = Database.getLastError();
		if (bRet) {
		  $$("sbQueryTime").label = "ET: " + timeElapsed;
		}

		//the following two lines must be before the code for tree
		//otherwise, it does not refresh the structure tree as expected
		this.refreshDbStructure();
		this.loadTabBrowse();
		
		treeExecute.ShowTable(false);
		if (bRet && queries.length == 1) {
		  treeExecute.createColumns(aColumns, 0, [], null);
		  treeExecute.PopulateTableData(aData, aColumns, aTypes);
		}
	},

  newDatabase: function() {
  	var sExt = "." + this.maFileExt[0];
		//prompt for a file name
		var fname = prompt(sm_getLFStr("sqlm.enterDatabaseName", [sExt]), "", sm_getLStr("sqlm.enterDatabaseName.title"));

		//if cancelled, abort
		if (fname == "" || fname == null)
			return false;
		
		//append the extension to the chosen name
		fname += sExt;
		
		//let the user choose the folder for the new db file	
		var dir = sm_chooseDirectory(sm_getLStr("selectFolderForDb"));
		if (dir != null) {
			//access this new copied file
			var newfile = Cc["@mozilla.org/file/local;1"]
								.createInstance(Ci.nsILocalFile);
			newfile.initWithPath(dir.path);
			newfile.append(fname);
			
			//if the file already exists, alert user that existing file will be opened 
			if(newfile.exists()) {
				alert(sm_getLStr("dbFileExists"));
			}

    	//if another file is already open,
			//confirm from user that it should be closed
    	if(this.closeDatabase(false)) {
				//assign the new file (nsIFile) to the current database
				this.sCurrentDatabase = newfile;
				//if the file does not exist, openDatabase will create it 
				this.setDatabase(this.sCurrentDatabase);
				return true;
			}
		}
		return false;
  },

	//closeDatabase: 
  closeDatabase: function(bAlert) {
		//nothing to close if no database is already open    
  	if(this.sCurrentDatabase == null)	{
   		if(bAlert)
        alert(sm_getLStr("noOpenDb"));
			return true;
		}
			
   	//if another file is already open, confirm before closing
   	var answer = true;
 		if(bAlert)
  		answer = smPrompt.confirm(null, sm_getLStr("extName"), sm_getLStr("confirmClose"));

  	if(!answer)
  		return false;

    //save StructureTreeState in ext mgmt table if mgmt is in use
    if (smExtManager.getUsage()) {
      smExtManager.setStructTreeState(smStructTrees[0].aExpandedNodes);
    }
		//make the current database as null and 
		//call setDatabase to do appropriate things
		this.sCurrentDatabase = null;
		this.setDatabase(this.sCurrentDatabase);
		return true;
	},
		
  copyDatabase: function() {
 		if(this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return;
		}
    var sExt = "." + this.maFileExt[0];
		//prompt for a file name
		var fname = prompt(sm_getLFStr("sqlm.enterDatabaseName", [sExt]), "", sm_getLStr("sqlm.enterDatabaseName.title"));

		//if cancelled, abort
		if (fname == "" || fname == null)
			return;
		else
			fname += sExt;
			
		//let the user choose the folder for the new db file	
		//let the user choose the folder for the new db file	
		var dir = sm_chooseDirectory(sm_getLStr("selectFolderForDb"));
		if (dir != null) {
			//copy the opened file to chosen location
			this.sCurrentDatabase.copyTo(dir, fname);

			//access this new copied file
			var newfile = Cc["@mozilla.org/file/local;1"]
								.createInstance(Ci.nsILocalFile);
			newfile.initWithPath(dir.path);
			newfile.append(fname);
			
			//if the file does not exist, openDatabase will create it 
			if(!newfile.exists()) {
				var ans = smPrompt.confirm(null, sm_getLStr("extName"), sm_getLStr("copyFailed"));
				if(!ans)
					return;
			}

			//assign the new file (nsIFile) to the current database
    	if(this.closeDatabase(false)) {
				this.sCurrentDatabase = newfile;
        this.setDatabase(this.sCurrentDatabase);
        return;
			}
		}
		return;
  },
    
  compactDatabase: function() {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}
		var befPageCount = Database.getSetting("page_count");
		var pageSize = Database.getSetting("page_size");
    var sQuery = "VACUUM";
    //cannot vacuum from within a transaction
    Database.selectQuery(sQuery);
		var aftPageCount = Database.getSetting("page_count");
    sm_alert(sm_getLStr("vacuum.title"), sm_getLFStr("vacuum.details", [befPageCount, befPageCount*pageSize, aftPageCount, aftPageCount*pageSize]));
    return true;
  },

  analyzeDatabase: function() {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
    }
  	var sQuery = "ANALYZE";
  	Database.selectQuery(sQuery);
  	return true;
  },

  checkIntegrity: function() {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
    }
    Database.selectQuery("PRAGMA integrity_check");
    var records = Database.getRecords();
    var columns = Database.getColumns();

    var txt = sm_getLStr("integrityResultPrefix") + ": ";
    //report OK if i row returned containing the value "ok"
    if (records.length == 1 && records[0][0] == "ok")
      alert(txt + sm_getLStr("ok"));
    else
      alert(txt + sm_getLStr("notOk"));
    return true;
  },

  openDatabase: function() {        
		const nsIFilePicker = Ci.nsIFilePicker;
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, sm_getLStr("selectDb"), nsIFilePicker.modeOpen);
    var sExt = "";
		for (var iCnt = 0; iCnt < this.maFileExt.length; iCnt++) {
      sExt += "*." + this.maFileExt[iCnt] + ";";
		}
	  fp.appendFilter(sm_getLStr("sqliteDbFiles") + " (" + sExt + ")", sExt);
		fp.appendFilters(nsIFilePicker.filterAll);
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		  // work with returned nsILocalFile...
    	if(this.closeDatabase(false)) {
				this.sCurrentDatabase = fp.file;
        this.setDatabase(this.sCurrentDatabase);
        return true;
			}
		}
		return false;
  },

  openDatabaseADS: function() {        
		const nsIFilePicker = Ci.nsIFilePicker;
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, sm_getLStr("selectDb"), nsIFilePicker.modeOpen);
    var sExt = "";
		for (var iCnt = 0; iCnt < this.maFileExt.length; iCnt++) {
      sExt += "*." + this.maFileExt[iCnt] + ";";
		}
	  fp.appendFilter(sm_getLStr("sqliteDbFiles") + " (" + sExt + ")", sExt);
		fp.appendFilters(nsIFilePicker.filterAll);
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
  		var check = {value: false};// default the checkbox to false
  		var input = {value: ""}; // default the edit field to table name
  		var result = smPrompt.prompt(null, sm_getLStr("sqlm.enterADSName") + fp.file.leafName, sm_getLStr("sqlm.enterADSName.descr"), input, null, check);
  		var sAdsName = input.value;
  		//returns true on OK, false on cancel
  		if (!result || sAdsName.length == 0)
  		  return false;

      var sPath = fp.file.path + ":" + sAdsName;
    	return this.openDatabaseWithPath(sPath);
		}
		return false;
  },

  openDatabaseWithPath: function(sPath) {
		var newfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		try {
      newfile.initWithPath(sPath);
    } catch (e) {
		  alert(sm_getLStr("sqlm.alert.fileNotFound") + sPath);
		  this.removeFromMru(sPath);
		  return false;
    }
		if(newfile.exists()) {
    	if(this.closeDatabase(false)) {
				this.sCurrentDatabase = newfile;
        this.setDatabase(this.sCurrentDatabase);
        return true;
			}
		}
		else {
		  alert(sm_getLStr("sqlm.alert.fileNotFound") + sPath);
		  this.removeFromMru(sPath);
		}
		return false;
  },

  saveDatabase: function() {        
  },

  createTable: function() {        
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}

		var aRetVals = {};
    window.openDialog("chrome://sqlitemanager/content/createTable.xul", "createTable", "chrome, resizable, centerscreen, modal, dialog", Database, aRetVals);
 		if (aRetVals.ok) {
      Database.confirmAndExecute([aRetVals.createQuery], sm_getLFStr("sqlm.confirm.createTable", [aRetVals.tableName]), "confirm.create");
  		this.refreshDbStructure();
	   	this.loadTabBrowse();
	  }
  },

  createObject: function(sObjectType) {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}

		var xul = "chrome://sqlitemanager/content/create" + sObjectType + ".xul";
		if (sObjectType == "view") {
   		var aRetVals = {dbName: Database.logicalDbName, tableName: this.aCurrObjNames["table"]};
      window.openDialog(xul, "create" + sObjectType, 
  						"chrome, resizable, centerscreen, modal, dialog", 
  						Database, aRetVals);
  		if (aRetVals.ok) {
        Database.confirmAndExecute(aRetVals.queries, sm_getLFStr("sqlm.confirm.createObj", [sObjectType, aRetVals.objectName]), "confirm.create");
    		this.refreshDbStructure();
  	   	this.loadTabBrowse();
  	  }
    }
    else
      window.openDialog(xul, "create" + sObjectType, 
  						"chrome, resizable, centerscreen, modal, dialog", 
  						Database, this.aCurrObjNames["table"], sObjectType);

		this.refreshDbStructure();
		this.loadTabBrowse();
		return true;
  },

  modifyView: function() {
    var sViewName = this.aCurrObjNames["view"];
		var info = Database.getMasterInfo(sViewName, "");
		var sOldSql = info.sql;
    var sSelect = getViewSchemaSelectStmt(sOldSql);

  	var aRetVals = {dbName: Database.logicalDbName, objectName: sViewName, modify: 1, selectStmt: sSelect};
    aRetVals.readonlyFlags = ["dbnames", "viewname"];
    window.openDialog("chrome://sqlitemanager/content/createview.xul", "createView", "chrome, resizable, centerscreen, modal, dialog", Database, aRetVals);
		if (aRetVals.ok) {
      Database.confirmAndExecute(aRetVals.queries, sm_getLFStr("sqlm.confirm.modifyView", [aRetVals.objectName]), "confirm.create");
  		this.refreshDbStructure();
	   	this.loadTabBrowse();
	  }
  },

  modifyTable: function(sTableName) {
//    alert("modtab: " + sTableName);
  },

  cancelEditColumn: function() {
    $$("gb-editColumn").hidden = true;
  },

  startEditColumn: function() {
//    var bConfirm = sm_confirm(sm_getLStr("dangerous.op"), "This is a potentially dangerous operation. SQLite does not support statements that can alter a column in a table. Here, we attempt to reconstruct the new CREATE SQL statement by looking at the pragma table_info which does not contain complete information about the structure of the existing table.\n\n" + sm_getLStr("q.proceed"));
//    if (!bConfirm)
//      return false;

    var treeCol = $$("treeTabCols");
    var row = treeCol.view.selection.currentIndex;
    var col = treeCol.columns.getColumnAt(1);
		var sOldName = treeCol.view.getCellText(row, col);
    var col = treeCol.columns.getColumnAt(2);
		var sOldType = treeCol.view.getCellText(row, col);
    var col = treeCol.columns.getColumnAt(4);
		var sOldDefault = treeCol.view.getCellText(row, col);

    var sTable = treeCol.getAttribute("smTableName");
    $$("tb-ec-table").value = sTable;

    $$("tb-ec-oldName").value = sOldName;
    $$("tb-ec-oldType").value = sOldType;
    $$("tb-ec-oldDefault").value = sOldDefault;
    $$("tb-ec-newName").value = sOldName;
    $$("tb-ec-newType").value = sOldType;
    $$("tb-ec-newDefault").value = sOldDefault;

    $$("gb-editColumn").hidden = false;
    $$("tb-ec-newName").focus();
  },

  alterColumn: function() {
    var bConfirm = sm_confirm(sm_getLStr("dangerous.op"), sm_getLStr("sqlm.confirm.dangerousOp") + sm_getLStr("q.proceed"));
    if (!bConfirm)
      return false;

    var sTable = $$("tb-ec-table").value;
	  var sOldName = $$("tb-ec-oldName").value;
	  var sNewName = $$("tb-ec-newName").value;
	  if (sNewName.length == 0) {
	    alert(sm_getLStr("sqlm.alterColumn.name"));
	    return false;
	  }
	  var sNewType = $$("tb-ec-newType").value;
    var sNewDefVal = $$("tb-ec-newDefault").value;
    if (sNewDefVal.length == 0)
      sNewDefVal = null;

    var aNewInfo = {oldColName: sOldName,
                    newColName: sNewName,
                    newColType: sNewType,
                    newDefaultValue: sNewDefVal};
		var bReturn = CreateManager.modifyTable("alterColumn", sTable, aNewInfo);
		if(bReturn) {
		  this.cancelEditColumn();

			this.refreshDbStructure();
			this.loadTabBrowse();
		}
		return bReturn;
  },

  dropColumn: function() {        
    var bConfirm = sm_confirm(sm_getLStr("dangerous.op"), sm_getLStr("sqlm.confirm.dangerousOp") + sm_getLStr("q.proceed"));
    if (!bConfirm)
      return false;
//    var bConfirm = sm_prefsBranch.getBoolPref("allowUnsafeTableAlteration");
    var treeCol = $$("treeTabCols");
    var row = treeCol.view.selection.currentIndex;
    var col = treeCol.columns.getColumnAt(1);
		var sColumn = treeCol.view.getCellText(row, col);
    var sTable = treeCol.getAttribute("smTableName");

		var bReturn = CreateManager.modifyTable("dropColumn", sTable, sColumn);
		if(bReturn) {
			this.refreshDbStructure();
			this.loadTabBrowse();
		}
		return bReturn;
  },

  reindexIndex: function() {        
  	var sCurrIndex = this.aCurrObjNames["index"];
  	if(sCurrIndex != null && sCurrIndex != undefined && sCurrIndex.length > 0) {
			var bReturn = Database.reindexObject("INDEX", sCurrIndex);
			return bReturn;
		}
		return false;
  },

	dropObject: function(sObjectType) {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}

		var sObjectName = "";
		sObjectName = this.aCurrObjNames[sObjectType];
		
		var aNames = this.aObjNames[sObjectType];

		if(aNames.length == 0) {
			alert(sm_getLStr("noObjectToDelete") + ": " + sObjectType);
			return false;
		}
		var bReturn = Database.dropObject(sObjectType, sObjectName);
		if(bReturn) {
			sm_message(sm_getLStr("dropDone"), 0x2);
			this.refreshDbStructure();
			this.loadTabBrowse();
		}
		return bReturn;
  },

  exportAll: function(sWhat) {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}
    var sDbName = Database.logicalDbName; //"main";
    var sExpType = "sql";
    var sFileName = sDbName;
    if (sDbName == "main") {
      sFileName = Database.getFileName();
	    var iPos = sFileName.lastIndexOf(".");
	    if (iPos > 0)
  	    sFileName = sFileName.substr(0, iPos);
    }
		// get export file
		const nsIFilePicker = Ci.nsIFilePicker;
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, sm_getLStr("sqlm.export.fp.title"), nsIFilePicker.modeSave);
		fp.appendFilters(nsIFilePicker.filterAll);
		fp.defaultString = sFileName + "." + sExpType;
		
		var rv = fp.show();
		
		//if chosen then
		if (rv != nsIFilePicker.returnOK && rv != nsIFilePicker.returnReplace) {
			alert(sm_getLStr("sqlm.export.fp.descr"));
			return false;
		}
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		file.initWithFile(fp.file);

		var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
		// use 0x02 | 0x10 to open file for appending.
		foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate

    var os = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
    
    // This assumes that fos is the nsIOutputStream you want to write to
    os.init(foStream, "UTF-8", 0, 0x0000);
    
    if (sWhat == "tables" || sWhat == "db") {
      var bCreate = true, bTransact = false;
  		var iExportNum = 0;
     	var aTableNames = Database.getObjectList("table", sDbName);
  		for (var i = 0; i < aTableNames.length; i++) {
  			iExportNum = SmExim.writeSqlContent(os, sDbName, aTableNames[i], bCreate, bTransact);
  		}
		}
		var aObjNames = [];
		if (sWhat == "dbstructure") {
     	var aTableNames = Database.getObjectList("table", sDbName);
      aObjNames = aObjNames.concat(aTableNames);
    }
		if (sWhat == "db" || sWhat == "dbstructure") {
     	var aViewNames = Database.getObjectList("view", sDbName);
      aObjNames = aObjNames.concat(aViewNames);
     	var aTriggerNames = Database.getObjectList("trigger", sDbName);
      aObjNames = aObjNames.concat(aTriggerNames);
     	var aIndexNames = Database.getObjectList("index", sDbName);
      aObjNames = aObjNames.concat(aIndexNames);
  		for (var i = 0; i < aObjNames.length; i++) {
        var sSql = Database.getMasterInfo(aObjNames[i], sDbName);
        if (sSql.sql != null)
          os.writeString(sSql.sql + ";\n");
      }
		}
    os.close();
		foStream.close();

		if (sWhat == "db")
		  sm_message(sm_getLFStr("sqlm.export.db", [fp.file.path]), 0x3);
		if (sWhat == "dbstructure")
		  sm_message(sm_getLFStr("sqlm.export.dbstructure", [fp.file.path]), 0x3);
		if (sWhat == "tables")
		  sm_message(sm_getLFStr("sqlm.export.tables", [aTableNames.length, fp.file.path]), 0x3);
		return true;
  },

	importFromFile: function() {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}
    SmExim.loadDialog("import");
	},
	
	exportObject: function(sObjectType) {
    if (this.sCurrentDatabase == null) {
			alert(sm_getLStr("firstOpenADb"));
			return false;
		}

		var sObjectName = this.aCurrObjNames[sObjectType];
    SmExim.loadDialog("export", sObjectType, sObjectName);
		return true;
  },

	copyTable: function(sTableName) {
		var xul = "chrome://sqlitemanager/content/copyTable.xul";
		var aRetVals = {};
    var ret = window.openDialog(xul, "copyTable", "chrome, centerscreen, modal, dialog", Database.logicalDbName, this.aCurrObjNames["table"], Database.getDatabaseList(), aRetVals);
    var sNewDb = aRetVals.newDbName;
    var sNewTable = aRetVals.newTableName;
    var bOnlyStructure = aRetVals.onlyStructure;

		if (sNewTable.length == 0)
		  return false;
		  
		var info = Database.getMasterInfo(sTableName, "");
		var r_sql = info.sql;
		sNewTable = Database.getPrefixedName(sNewTable, sNewDb);
		var sOldTable = Database.getPrefixedName(sTableName, "");	

    var sNewSql = replaceObjectNameInSql(r_sql, sNewTable);
    if (sNewSql == "") {
      alert(sm_getLStr("sqlm.copyTable.newSqlFailed"));
      return;
    }

		var aQueries = [sNewSql];
		if(!bOnlyStructure) {
			aQueries.push("INSERT INTO " + sNewTable + " SELECT * FROM " + sOldTable);
		}
		return Database.confirmAndExecute(aQueries, sm_getLStr("sqlm.copyTable.confirm") + ": " + sTableName);
	},

	renameTable: function(sTableName)	{
		var check = {value: false};
		var input = {value: sTableName};
		var result = smPrompt.prompt(null, sm_getLFStr("sqlm.renameTable", [sTableName]), sm_getLStr("sqlm.renameTable.descr"), input, null, check);
		var sNewName = input.value;
		//returns true on OK, false on cancel
		if (!result || sNewName.length == 0)
		  return false;
    return Database.renameTable(sTableName, sNewName, '');
	},

	renameObject: function(sObjType)	{
    var sObjName = this.aCurrObjNames[sObjType];
		var check = {value: false};   // default the checkbox to false
		var input = {value: sObjName};   // default the edit field to object name
		var result = smPrompt.prompt(null, sm_getLFStr("sqlm.renameObj", [sObjType, sObjName]), sm_getLFStr("sqlm.renameObj.descr", [sObjType]), input, null, check);
		var sNewName = input.value;
		//returns true on OK, false on cancel
		if (!result || sNewName.length == 0)
		  return false;
		  
		sNewName = Database.getPrefixedName(sNewName, "");
		var info = Database.getMasterInfo(sObjName, "");
		var sOldSql = info.sql;
    var sNewSql = replaceObjectNameInSql(sOldSql, sNewName);
    if (sNewSql == "") {
      alert(sm_getLStr("sqlm.renameObj.newSqlFailed"));
      return;
    }
		var sOldName = Database.getPrefixedName(sObjName, "");

		var aQueries = [];
		aQueries.push("DROP " + sObjType + " " + sOldName);
		aQueries.push(sNewSql);
		var bReturn = Database.confirmAndExecute(aQueries, sm_getLFStr("sqlm.renameObj.confirm", [sObjType, sOldName]));
		if(bReturn)	this.refresh();
	},

// operateOnTable: various operations on a given table
// sOperation = rename | copy | reindex | delete	| 
//              insert | duplicate | update
  operateOnTable: function(sOperation) {
		//these operations make sense in the context of some table
		//so, take action only if there is a valid selected db and table
	  if (this.sCurrentDatabase == null || this.aCurrObjNames["table"] == null) {
			alert(sm_getLStr("noDbOrTable"));
			return false;
		}
  	var sCurrTable = this.aCurrObjNames["table"];
  	var bReturn = false;
  	var bRefresh = false; //to reload tabs
		switch(sOperation) {
			case "reindex":
				return Database.reindexObject("TABLE", sCurrTable);
				break;
			case "analyze":
			  return Database.analyzeTable(sCurrTable);
				break;
		}
  	if(sOperation == "copy") {
			var bReturn = this.copyTable(sCurrTable);
			if(bReturn)	this.refresh();
			return bReturn;
		}
  	if(sOperation == "rename") {
			var bReturn = this.renameTable(sCurrTable);
			if(bReturn)	this.refresh();
			return bReturn;
		}
  	if(sOperation == "drop") {
			var bReturn = Database.dropObject("TABLE", sCurrTable);
			if(bReturn)	this.refresh();
			return bReturn;
		}
  	if(sOperation == "modify") {
			this.modifyTable(sCurrTable);
			return;
		}
  	if(sOperation == "empty") {
      var bReturn = Database.emptyTable(sCurrTable);
      if(bReturn)	this.refresh();
      return bReturn;
    }
    if(sOperation == "addColumn") {
      var newCol = [];
      newCol["name"] = $$("tb-addcol-name").value;
      newCol["type"] = $$("tb-addcol-type").value;
      newCol["notnull"] = $$("tb-addcol-notnull").checked;
      newCol["dflt_value"] = $$("tb-addcol-default").value;
      newCol["dflt_value"] = SQLiteFn.makeDefaultValue(newCol["dflt_value"]);

      var bReturn = Database.addColumn(sCurrTable, newCol);
      if(bReturn) {
        $$("tb-addcol-name").value = "";
        $$("tb-addcol-type").value = "";
        $$("tb-addcol-notnull").checked = false;
        $$("tb-addcol-default").value = "";
        this.refresh();
      }
      $$("tb-addcol-name").focus();
      return bReturn;
    }

		//update the first selected row in the tree, else alert to select
  	//if selection exists, pass the rowid as the last arg of openDialog
  	var aRowIds = [];
  	var rowCriteria = "";
  	if(sOperation == "update" || sOperation == "delete" || sOperation == "duplicate") {
  		var colMain = Database.getTableRowidCol(this.aCurrObjNames["table"]);
			colMain["name"] = SQLiteFn.quoteIdentifier(colMain["name"]);

  		//allowing for multiple selection in the tree
			var tree = $$("browse-tree");
			var start = new Object();
			var end = new Object();
			var numRanges = tree.view.selection.getRangeCount();

			for (var t = 0; t < numRanges; t++) {
				tree.view.selection.getRangeAt(t,start,end);
			  for (var v = start.value; v <= end.value; v++) {
			  	var rowid = tree.view.getCellText(v,
							tree.columns.getColumnAt(colMain["cid"]));
					aRowIds.push(rowid);
			  }
			}
			//do nothing, if nothing is selected
			if(aRowIds.length == 0)	{
				alert(sm_getLStr("noRecord"));
				return false;
			}
			//if editing, should select only one record
			if (sOperation == "update" || sOperation == "duplicate")	{
				if (aRowIds.length != 1) {
					alert(sm_getLStr("onlyOneRecord"));
					return false;
				}
				rowCriteria = " " + colMain["name"] + " = " + aRowIds[0];
			}
			//if deleting, pass as argument rowid of all selected records to delete
			if (sOperation == "delete") {
    		var criteria = colMain["name"] + " IN (" + aRowIds.toString() + ")";
    		var sQuery = "DELETE FROM " + Database.getPrefixedName(sCurrTable, "") + " WHERE " + criteria;
    		//IMPORTANT: the last parameter is totally undocumented.
				var bReturn = Database.confirmAndExecute([sQuery], [sm_getLFStr("sqlm.deleteRecs", [aRowIds.length, sCurrTable]), false]);
				if(bReturn)
					this.loadTabBrowse();
				return bReturn;
			}
		}
/* following code if dialog is popped up for editing etc. */
    var bUseWindow = true;
    if (bUseWindow) {
      window.openDialog("chrome://sqlitemanager/content/RowOperations.xul", "RowOperations", "chrome, resizable, centerscreen, modal, dialog", Database, this.aCurrObjNames["table"], sOperation, rowCriteria);
  		if(sOperation != "update") {
  			this.refreshDbStructure();
  		}
  		this.loadTabBrowse();
		}
    else {
      RowOps.loadDialog(this.aCurrObjNames["table"], sOperation, rowCriteria);
    }

		return true;
  },

  selectDefaultDir: function(sType) {
    var file = sm_chooseDirectory(sm_getLStr("sqlm.selectDefaultDir"));

    // 1. Write to prefs
    var relFile = Cc["@mozilla.org/pref-relativefile;1"]
                  .createInstance(Ci.nsIRelativeFilePref);
    relFile.relativeToKey = "ProfD";
    relFile.file = file;      // |file| is nsILocalFile
    sm_prefsBranch.setComplexValue("userDir", Ci.nsIRelativeFilePref, relFile);
    this.populateDBList("user");
  },

  // populateDBList: Load list of files with default file extensions
  populateDBList: function(sType) {
    var fileList;
    var sTooltip = sm_getLStr("sqlm.tooltip.profileDir");
    var sSelectString = sm_getLStr("selectProfileDb");
    if (sType == "profile")
      // Get the nsIFile object pointing to the profile directory
      fileList = Cc["@mozilla.org/file/directory_service;1"]
            .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile)
            .directoryEntries;
    if (sType == "user") {
      sSelectString = sm_getLStr("selectDbInDefaultDir");
      //Read from prefs
      var value = sm_prefsBranch.getComplexValue("userDir",Ci.nsIRelativeFilePref);
      // |value.file| is the file.
      sTooltip = value.file.path;
			var lFile = value.file;
      fileList = lFile.directoryEntries;
    }
    //get the node for the popup menus to show profile db list
    var listbox = $$("listbox-profileDB");
    listbox.setAttribute("dirType", sType);
    listbox.setAttribute("tooltiptext", sTooltip);
    $$("menu-DbList").setAttribute("tooltiptext", sTooltip);

    listbox.removeAllItems();
    listbox.appendItem(sSelectString, "");
    listbox.selectedIndex = 0;

    var aSplit, sExt;
    var file;
    var iFileCount = 0;
		while (fileList.hasMoreElements()) {
      file = fileList.getNext().QueryInterface(Ci.nsIFile);
      aSplit = file.leafName.split(".");
      sExt = aSplit[aSplit.length - 1]; 

      if (this.maFileExt.indexOf(sExt) != -1) {
        iFileCount++;
        listbox.appendItem(file.leafName, file.path);
      }
    }
    sm_message(sm_getLStr("filesInProfileDbList") + ": " + iFileCount, 0x2);
  },

  // openSelectedDatabase: open a file from the database dropdown list
  openSelectedDatabase: function(sMenuListId) { 
		//get the node for dropdown menu in which profile db list is shown       
  	var listbox = $$(sMenuListId);
    var sPath = listbox.selectedItem.value;
    var sType = listbox.getAttribute("dirType"); //profile/user

		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		file.initWithPath(sPath);

		//proceed only if the file exists
		//we are in the profile folder via the listbox, so open if the file exists
		//do not attempt to create new file
		if(!file.exists()) {
			alert(sm_getLStr("invalidProfileDb"));
			return false;
		}
  	if(this.closeDatabase(false))	{
			this.sCurrentDatabase = file;
      this.setDatabase(this.sCurrentDatabase);
      return true;
		}
		return false;
	},

  changeAttachedDb: function() {
    var mlist = $$("ml-dbNames");
	  var mi = mlist.selectedItem;
	  var sDbName = mi.getAttribute("dbName");
	  if (sDbName == "")
	   return false;

	  Database.setLogicalDbName(sDbName);
	  this.refreshDbStructure();
	  return true;
  },

  detachDatabase: function() {
    var mlist = $$("ml-dbNames");
	  var mi = mlist.selectedItem;
	  var sDbName = mi.getAttribute("dbName");
    if (mlist.selectedIndex <= 2) {
      alert(sm_getLStr("sqlm.detachDb.alert"));
      return false;
    }

    var answer = smPrompt.confirm(null, sm_getLStr("extName"), sm_getLFStr("sqlm.detachDb.confirm", [sDbName]) + mi.getAttribute("tooltiptext"));
		if(!answer) {
		  return false;
     } 
		var sQuery = "DETACH DATABASE " + SQLiteFn.quoteIdentifier(sDbName);
		if (Database.selectQuery(sQuery)) {
		  var mi = mlist.removeItemAt(mlist.selectedIndex);
      mlist.selectedIndex = 0;
      this.changeAttachedDb();
		  sm_message(sm_getLFStr("sqlm.detachDb.msgOk", [sDbName]), 0x2);
      return true;
		}
		else {
		  sm_message(sm_getLFStr("sqlm.detachDb.msgFailed", [sDbName]), 0x2);
		  return false;
		}
  },

  attachDatabase: function() {
		if(this.sCurrentDatabase == null)	{
			alert(sm_getLStr("firstOpenADb"));
			return;
		}
		const nsIFilePicker = Ci.nsIFilePicker;
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, sm_getLStr("selectDb"), nsIFilePicker.modeOpen);
    var sExt = "";
		for (var iCnt = 0; iCnt < this.maFileExt.length; iCnt++) {
      sExt += "*." + this.maFileExt[iCnt] + ";";
		}
	  fp.appendFilter(sm_getLStr("sqliteDbFiles") + " (" + sExt + ")", sExt);
		fp.appendFilters(nsIFilePicker.filterAll);
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		  // work with returned nsILocalFile...
    	var sPath = SQLiteFn.quoteIdentifier(fp.file.path);

      var check = {value: false};
  		var input = {value: ""};
  		var result = smPrompt.prompt(null, sm_getLFStr("sqlm.attachDb", [sPath]), sm_getLStr("sqlm.attachDb.descr"), input, null, check);
  		var sDbName = input.value;
  		//returns true on OK, false on cancel
  		if (!result || sDbName.length == 0)
  		  return false;

  		var sQuery = "ATTACH DATABASE " + sPath + " AS " + SQLiteFn.quoteIdentifier(sDbName);
  		if (Database.selectQuery(sQuery)) {
  		  var mi = $$("ml-dbNames").appendItem(sDbName, sDbName, fp.file.leafName);
  		  mi.setAttribute("dbName", sDbName);
  		  mi.setAttribute("tooltiptext", sPath);

  		  sm_message(sm_getLFStr("sqlm.attachDb.msgOk", [sPath, sDbName]), 0x2);
        return true;
  		}
  		else {
  		  sm_message(sm_getLFStr("sqlm.attachDb.msgFailed", [sPath]), 0x2);
  		  return false;
  		}  		
		}
		return false;
  },

  createTimestampedBackup: function(nsiFileObj) {
    if (!nsiFileObj.exists()) //exit if no such file
      return false;

    switch (sm_prefsBranch.getCharPref("autoBackup")) {
      case "off":     return false;
      case "on":      break;
      case "prompt":
        var bAnswer = smPrompt.confirm(null, sm_getLStr("extName"), sm_getLStr("confirmBackup"));
        if (!bAnswer) return false;
        break;
      default:        return false;    
    }

    //construct a name for the new file as originalname_timestamp.ext
//    var dt = new Date();
//    var sTimestamp = dt.getFullYear() + dt.getMonth() + dt.getDate(); 
    var sTimestamp = getISODateTimeFormat(null, "", "s");//Date.now(); 
    var sFileName = nsiFileObj.leafName;
    var sMainName = sFileName, sExt = "";
    var iPos = sFileName.lastIndexOf(".");
    if (iPos > 0) {
	    sMainName = sFileName.substr(0, iPos);
	    sExt = sFileName.substr(iPos);
	  }
    var sBackupFileName = sMainName + "_" + sTimestamp + sExt;

    //copy the file in the same location as the original file
    try {
		  nsiFileObj.copyTo(null, sBackupFileName);
		} catch (e) {
		  alert(sm_getLFStr("sqlm.backup.failed", [sBackupFileName, e.message]));
		}
		return true;
  },

  openMemoryDatabase: function() {
  	if(this.closeDatabase(false)) {
			this.sCurrentDatabase = "memory";
      this.setDatabase(this.sCurrentDatabase);
      return true;
		}
		return false;
  },

  // setDatabase: set the current database to nsiFileObj
  // If nsiFileObj is a string, then openSpecialDatabase
  setDatabase: function(nsiFileObj) {
  //when passed as arg, works but fails to show .path and .leafName properties
//      this.sCurrentDatabase = nsiFileObj; 

    this.mbDbJustOpened = true;

    var mlist = $$("ml-dbNames");
    mlist.removeAllItems();

		treeBrowse.ShowTable(false);
		treeExecute.ShowTable(false);

    $$("sbSharedMode").label = "---";

		//try connecting to database
		var bConnected = false;
		try	{
			if(this.sCurrentDatabase != null) {
        if (this.sCurrentDatabase == "memory") {
          bConnected = Database.openSpecialDatabase("memory");
        }
        else {
  			 //create backup before opening
          this.createTimestampedBackup(this.sCurrentDatabase);
  
          var mi = $$("menu-general-sharedPagerCache");
          var bSharedPagerCache = mi.hasAttribute("checked");
          bConnected = Database.openDatabase(this.sCurrentDatabase,bSharedPagerCache);
        }
        $$("vb-structureTab").hidden = false;
        $$("vb-browseTab").hidden = false;
        $$("vb-executeTab").hidden = false;
        $$("vb-dbInfoTab").hidden = false;

        $$("bc-dbOpen").removeAttribute("disabled");
		  }
			if(this.sCurrentDatabase == null) {
		    Database.closeConnection();
    		//call it to hide all things there - Issue #90, etc.
        $$("bc-dbOpen").setAttribute("disabled", true);

        this.emptyTabStructure();
     		$$("vb-structureTab").hidden = true;
    		$$("vb-browseTab").hidden = true;
    		$$("vb-executeTab").hidden = true;
    		$$("vb-dbInfoTab").hidden = true;
        this.useExtensionManagementTable(false, true);
		  }
		} 
		catch (e)	{
	    var sTemp = this.sCurrentDatabase.path;
	    this.sCurrentDatabase = null;
	    sm_message("Connect to '" + sTemp + "' failed: " + e, 0x3);
	    return;
		}

    var path = "", leafName = "";
    if (bConnected) {
      $$("sbSharedMode").label = Database.getOpenStatus();

      if (nsiFileObj.path) {
        path = nsiFileObj.path;
        leafName = nsiFileObj.leafName;
        //change the mruPath.1 in preferences
        this.setMruList(path);
      }
      else {
        path = "in-memory database";
        leafName = "in-memory";
      }

      //extension related mgmt info
      smExtManager = new SMExtensionManager();
      this.useExtensionManagementTable(smExtManager.getUsage(), true);

      //populate the db list menu with main and temp
      var mlist = $$("ml-dbNames");
      mlist.removeAllItems();
      var mi = mlist.appendItem(leafName, leafName, "");
      mi.setAttribute("dbName", "main");
      mi.setAttribute("tooltiptext", path);
      var mi = mlist.appendItem(sm_getLStr("sqlm.tooltip.tempObj"), sm_getLStr("sqlm.tooltip.tempObj"), "");
      mi.setAttribute("dbName", "temp");
      mi.setAttribute("tooltiptext", sm_getLStr("sqlm.tooltip.tempDbObj"));
      var mi = mlist.appendItem(sm_getLStr("sqlm.tooltip.attachedDbs"), sm_getLStr("sqlm.tooltip.attachedDbs"), "");
      mi.setAttribute("dbName", "");
      mi.setAttribute("disabled", "true");
  
      mlist.selectedIndex = 0;
      this.changeAttachedDb();
      //display the sqlite version in the status bar
      var sV = sm_getLStr("sqlite") + " " + Database.sqliteVersion;
      $$("sbSqliteVersion").setAttribute("label",sV);

      //this function should return functions that need to be applied to this db
      var udf = smUDF.getDbFunctions();
      for (var fn in udf) {//        eval('func = ' + udf[fn].funcText);

        if (gbGecko_1914pre) //for gecko 1.9.1.4pre and higher
          Database.createFunction(udf[fn].fName, udf[fn].fLength, udf[fn].onFunctionCall);
        else   //for older gecko
          Database.createFunction(udf[fn].fName, udf[fn].fLength, udf[fn]);

        sm_log("Loaded SQLite function: " + udf[fn].fName + ", args.length = " + udf[fn].fLength);
      }
//      Database.createFunction('xxx', 2, xxx);
    }

    if (!bConnected) {
    	this.sCurrentDatabase = null;
    }
    //change window title to show db file path
		document.title = sm_getLStr("extName") + " - " + path;
		//reload the two tabs
    this.refreshDbStructure();

    this.mbDbJustOpened = false;
  },

  selectAllRecords: function() {
    var t;
    if(this.getSelectedTabId() == "tab-browse")
      t = $$("browse-tree");
    else if(this.getSelectedTabId() == "tab-execute")
      t = $$("treeSqlOutput");
    else
      return;

    t.view.selection.selectAll();
    t.focus();
  },

  openOptionsWindow: function(aElt) {
    var instantApply = smPrefAll.getBoolPref("browser.preferences.instantApply");
    var features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
    openDialog(smChromes.preferences, 'preferences', features);
  },

  openConsoleWindow: function(aElt) {
    window.openDialog(smChromes.console, 'console', 'chrome,resizable,titlebar,toolbar,centerscreen,modal');
  },

  openAboutConfigWindow: function(aElt) {
    window.openDialog(smChromes.aboutconfig, 'aboutconfig', 'chrome,resizable,titlebar,toolbar,centerscreen,modal');
  },

  openDomIWindow: function(aElt) {
    // Load the Window DataSource so that browser windows opened subsequent to DOM Inspector show up in the DOM Inspector's window list.
    var windowDS = Cc["@mozilla.org/rdf/datasource;1?name=window-mediator"].getService(Ci.nsIWindowDataSource);
    var tmpNameSpace = {};                         
    var sl = Cc["@mozilla.org/moz/jssubscript-loader;1"].createInstance(Ci.mozIJSSubScriptLoader);
    sl.loadSubScript("chrome://inspector/content/hooks.js", tmpNameSpace);
    tmpNameSpace.inspectDOMDocument(document);
  },

  saveBrowseTreeColState: function(aElt) {
    while (aElt.nodeName != "tree") {
      aElt = aElt.parentNode;
    }
    if (aElt.id == "browse-tree") {
      var aWidth = [];
      var aId = [];
      var aCols = aElt.querySelectorAll("treecol");
      for (var i = 0; i < aCols.length; i++) {
        aWidth.push(aCols.item(i).width);
        aId.push(aCols.item(i).id);
      }
      var objColInfo = {};
      objColInfo.arrWidth = aWidth;
      objColInfo.arrId = aId;
      objColInfo.sObjType = aElt.getAttribute("smObjType");
      objColInfo.sObjName = aElt.getAttribute("smObjName");
      var jsonObjColInfo = JSON.stringify(objColInfo);
      smExtManager.saveBrowseTreeColState(objColInfo.sObjType, objColInfo.sObjName, jsonObjColInfo);
//      alert(jsonObjColInfo);
    }
  },

  setSqlText: function(val) {
    $$("txtSqlStatement").value = val;
  }
};

//observer for something
function smExampleObserver() {
  this.register();
}

smExampleObserver.prototype = 
{
  observe: function(subject, topic, data) {
     // Do your stuff here.
  },
  
	register: function() {
    var observerService = Cc["@mozilla.org/observer-service;1"]
                          .getService(Ci.nsIObserverService);
    observerService.addObserver(this, "myTopicID", false);
  },
  
	unregister: function() {
    var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    observerService.removeObserver(this, "myTopicID");
  }
}
