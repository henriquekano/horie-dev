const CC = Components.classes;
const CI = Components.interfaces;
const SM_CHROME = "chrome://sqlitemanager/content/";

var smPrefService= CC["@mozilla.org/preferences-service;1"].getService(CI.nsIPrefService).getBranch("extensions.sqlitemanager.");

function sm_start() {
    var md = window.QueryInterface(CI.nsIInterfaceRequestor)
      .getInterface(CI.nsIWebNavigation)
      .QueryInterface(CI.nsIDocShellTreeItem).rootTreeItem
      .QueryInterface(CI.nsIInterfaceRequestor)
      .getInterface(CI.nsIDOMWindow).document;
    var iVal = smPrefService.getIntPref("posInTargetApp");
    if (iVal == 0)
      md.getElementById("menuitem-sqlitemanager").setAttribute("hidden", true);
    if (iVal == 1)
      md.getElementById("menuitem-sqlitemanager").setAttribute("hidden", false);
}

function OpenSQLiteManager() {
  if (smPrefService == null)
    smPrefService = CC["@mozilla.org/preferences-service;1"].getService(CI.nsIPrefService).getBranch("extensions.sqlitemanager.");
  var iOpenMode;
  try {
    iOpenMode = smPrefService.getIntPref("openMode");
  } 
  catch(e) {
    iOpenMode = 1;
  }

  switch (iOpenMode) {
    case 1:      //open a chrome window
      OpenSMInOwnWindow();
      break;
    case 2:      //open in a new tab
      openUILinkIn(SM_CHROME,"tab");
      break;
  }
}

//Sb & Tb
function OpenSMInOwnWindow() {
  window.open(SM_CHROME, "", "chrome,resizable,centerscreen");
  return;
}

//Ko
function OpenSQLiteManagerKo() {
  if (smPrefService == null)
    smPrefService = CC["@mozilla.org/preferences-service;1"].getService(CI.nsIPrefService).getBranch("extensions.sqlitemanager.");
  var iOpenMode;
  try {
    iOpenMode = smPrefService.getIntPref("openMode");
  } 
  catch(e) {
    iOpenMode = 1;
  }

  switch (iOpenMode) {
    case 1:      //open a chrome window
      window.openDialog(SM_CHROME, 'navigator:browser', 'chrome,all,resizable');
      break;
    case 2:      //open in a new tab
//      ko.windowManager.openOrFocusDialog(SM_CHROME, 'navigator:sm',  'chrome,all,resizable');
      ko.views.manager.doFileOpenAsync(SM_CHROME, 'browser');
//      ko.open.URI(SM_CHROME,"browser");
      break;
  }
}

