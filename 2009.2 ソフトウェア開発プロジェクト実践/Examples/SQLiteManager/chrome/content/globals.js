const Cc = Components.classes;
const Ci = Components.interfaces;

const smChromes = {
  preferences: "chrome://sqlitemanager/content/preferences.xul",
  console: "chrome://global/content/console.xul",
  aboutconfig: "chrome://global/content/config.xul",
  confirm: "chrome://sqlitemanager/content/confirm.xul",
  aboutSM: "chrome://sqlitemanager/content/about.xul"
};

const smWebpages = {
  home: "http://sqlite-manager.googlecode.com/",
  faq: "http://code.google.com/p/sqlite-manager/wiki/FAQ",
  issueNew: "http://code.google.com/p/sqlite-manager/issues/entry",
  sqliteHome: "http://www.sqlite.org/",
  sqliteLang: "http://www.sqlite.org/lang.html",
  mpl: "http://www.mozilla.org/MPL/MPL-1.1.html"
};

const smDialogFeatures = "chrome,resizable,centerscreen,modal,dialog";

//these are the preferences which are being observed and which need to be initially read.
const smObservedPrefs = ["hideMainToolbar", "showMainToolbarDatabase", "showMainToolbarTable", "showMainToolbarIndex", "showMainToolbarDebug", "sqliteFileExtensions", "displayNumRecords", "textForBlob", "showBlobSize", "maxSizeToShowBlobData", "mruPath.1",
      "posInTargetApp" /* this one for firefox only*/,
      "handleADS" /* this one for Windows only*/ ];

//constant for branch of nsIPrefService                 
const sm_prefsBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.sqlitemanager.");

/* set unicode string value */
function sm_setUnicodePref(prefName, prefValue) {
    var sString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
    sString.data = prefValue;
    sm_prefsBranch.setComplexValue(prefName, Ci.nsISupportsString, sString);
}
var gAppInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
var gbGecko_1914pre = (Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator).compare(gAppInfo.platformVersion, "1.9.1.4pre") >= 0);

var gExtVersion = "";
var gExtCreator = "";
var gExtLocation = "";
sm_setAppInfo();


var smStrings = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService).createBundle("chrome://sqlitemanager/locale/strings.properties");
//gets localized string
function sm_getLStr(sName) {
  return smStrings.GetStringFromName(sName);
}
//gets localized and formatted string
function sm_getLFStr(sName, params, len) {
  return smStrings.formatStringFromName(sName, params, params.length);
}

var g_tempNamePrefix = "__temp__";
var gOS = navigator.appVersion;

var smPrompt = 	Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
var smPrefAll = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

var gSbPanelDisplay = null;

function $$(sId) {
  return document.getElementById(sId);
}

// ClearElement: Remove all child elements 
function ClearElement(el) {
  while (el.firstChild) 
    el.removeChild(el.firstChild);
}

// PopulateDropDownItems: Populate a dropdown listbox with menuitems
function PopulateDropDownItems(aItems, dropdown, sSelectedItemLabel) {   
  dropdown.removeAllItems();
  dropdown.selectedIndex = -1;

  for (var i = 0; i < aItems.length; i++) {
 		var bSelect = false;
  	if(i == 0)
  		bSelect = true;
  	
    if (typeof aItems[i] == "string") {
    	if(aItems[i] == sSelectedItemLabel)
    		bSelect = true;
    }
    else {
    	if(aItems[i][0] == sSelectedItemLabel)
    		bSelect = true;
  	}
    var menuitem = AddDropdownItem(aItems[i], dropdown, bSelect);
  }
}

// AddDropdownItem: Add a menuitem to the dropdown
function AddDropdownItem(sLabel, dropdown, bSelect) {
  var menuitem;
  if (typeof sLabel == "string") {
	  menuitem = dropdown.appendItem(sLabel, sLabel);
  }
  else {
	  menuitem = dropdown.appendItem(sLabel[0], sLabel[1]);
	}

  //make this item selected
	if (bSelect)
    dropdown.selectedItem = menuitem;

  return menuitem;
}

function sm_notify(sBoxId, sMessage, sType, iTime) {
  if (iTime == undefined)
    iTime = 3;

  iTime = iTime * 1000;
  var notifyBox = $$(sBoxId);
  var notification = notifyBox.appendNotification(sMessage);
  notification.type = sType;
  //notification.priority = notifyBox.PRIORITY_INFO_HIGH;
  setTimeout('$$("'+sBoxId+'").removeAllNotifications(false);', iTime);
}

//not yet called anywhere
function sm_launchHelp() {
	var urlHelp = sm_getLStr("sm.url.help");
	sm_openURL(urlHelp);
}

function sm_openURL(UrlToGoTo) {
  var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  var uri = ios.newURI(UrlToGoTo, null, null);
  var protocolSvc = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);

  if (!protocolSvc.isExposedProtocol(uri.scheme)) {
    // If we're not a browser, use the external protocol service to load the URI.
    protocolSvc.loadUrl(uri);
    return;
  }

  var navWindow;

  // Try to get the most recently used browser window
  try {
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    navWindow = wm.getMostRecentWindow("navigator:browser");
  } catch(ex) {}

  if (navWindow) {  // Open the URL in most recently used browser window
    if ("delayedOpenTab" in navWindow) {
      navWindow.delayedOpenTab(UrlToGoTo);
    } 
    else if ("openNewTabWith" in navWindow) {
      navWindow.openNewTabWith(UrlToGoTo);
    } 
    else if ("loadURI" in navWindow) {
      navWindow.loadURI(UrlToGoTo);
    }
    else {
      navWindow._content.location.href = UrlToGoTo;
    }
  }
  else {
    // If there is no recently used browser window then open new browser window with the URL
    var ass = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
    var win = ass.hiddenDOMWindow;
    win.openDialog(sm_getBrowserURL(), "", "chrome,all,dialog=no", UrlToGoTo );
  }
}

function sm_getBrowserURL() {
   // For SeaMonkey etc where the browser window is different.
   try {
      var url = smPrefAll.getCharPref("browser.chromeURL");
      if (url)
         return url;
   } catch(e) {}
   return "chrome://browser/content/browser.xul";
}

function sm_chooseDirectory(sTitle) {
	const nsIFilePicker = Ci.nsIFilePicker;
	var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, sTitle, nsIFilePicker.modeGetFolder);

	var rv = fp.show();

	//if chosen then
	if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace)
		return fp.file;

	return null; 
}

function sm_message(str, where) {
	if(where & 0x1)
		alert(str);
	if(where & 0x2 && gSbPanelDisplay != null)
		gSbPanelDisplay.label= str;;
	if(where & 0x4)
		sm_log(str);
}

function sm_confirm(sTitle, sMessage) {
	var aRetVals = {};
  var oWin = window.openDialog(smChromes.confirm, "confirmDialog", smDialogFeatures, sTitle, sMessage, aRetVals, "confirm");
  return aRetVals.bConfirm;
}

function sm_alert(sTitle, sMessage) {
	var aRetVals = {};
  var oWin = window.openDialog(smChromes.confirm, "alertDialog", smDialogFeatures, sTitle, sMessage, aRetVals, "alert");
}

//cTimePrecision: Y, M, D, h, m, s
function getISODateTimeFormat(dt, cSeparator, cPrecision) {
  var aPrecision = ["Y", "M", "D", "h", "m", "s"];
  var aSeparators = ["", "-", "-", "T", ":", ":"];
  if (dt == null)
    dt = new Date();

  var tt;
  var iPrecision = aPrecision.indexOf(cPrecision);
  var sDate = dt.getFullYear();
  for (var i = 1; i <= iPrecision; i++) {
    switch (i) {
      case 1:
        tt = new Number(dt.getMonth() + 1);
        break;
      case 2:
        tt = new Number(dt.getDate());
        break;
      case 3:
        tt = new Number(dt.getHours());
        break;
      case 4:
        tt = new Number(dt.getMinutes());
        break;
      case 5:
        tt = new Number(dt.getSeconds());
        break;
    }
    var cSep = (cSeparator == null)?aSeparators[i]:cSeparator;
    sDate += cSep + ((tt < 10)? "0" + tt.toString() : tt);
  }
  return sDate;
}

function sm_setAppInfo(sInfo) {
  var extId = "SQLiteManager@mrinalkant.blogspot.com";
  var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
  if (appInfo.ID == extId) {
    gExtVersion = appInfo.version;
    gExtCreator = appInfo.vendor;
    gExtLocation = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get('CurProcD', Ci.nsIFile).path;
  }
  else {
    var extInfo = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager).getItemForID(extId);
    gExtVersion = extInfo.version;
    gExtCreator = "Mrinal Kant";
    gExtLocation = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager).getInstallLocation(extId).getItemFile(extId, '').path;
  }
}

function sm_log(sMsg) {
  var aConsoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

  aConsoleService.logStringMessage("SQLiteManager: " + sMsg);
}

var SmGlobal = {
  confirmBeforeExecuting: function(aQ, sMessage, confirmPrefName) {
    if (confirmPrefName == undefined)
      confirmPrefName = "confirm.otherSql";
    var bConfirm = sm_prefsBranch.getBoolPref(confirmPrefName);

	  var answer = true;
	  var ask = sm_getLStr("globals.confirm.msg");
	  //in case confirmation is needed, reassign value to answer
    if (bConfirm) {
    	var txt = ask + "\n" + sMessage + "\nSQL:\n" + aQ.join("\n");
    	if (typeof sMessage == "object" && !sMessage[1]) {
    		txt = ask + "\n" + sMessage[0];
    	}
		  answer = sm_confirm(sm_getLStr("globals.confirm.title"), txt);
	  }

	  return answer;
  }
};
