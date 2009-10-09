Components.utils.import('resource://historybuck-modules/historybuck.jsm');
Components.utils.import('resource://historybuck-modules/urlmanager.jsm');

function openWindow(){
	var needToOpen = true;
	var windowType = "HistoryBuck";

	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var windows = wm.getEnumerator(windowType);
	
    var tab = getBrowser().mTabContainer.firstChild;
    while (tab) {
            if (getBrowser().getBrowserForTab(tab).contentDocument.documentElement.getAttribute("windowtype") == windowType) {
                    getBrowser().selectedTab = tab;
                    needToOpen = false;
                    break;
            }
            tab = tab.nextSibling;
    }
    if (needToOpen) {
            getBrowser().selectedTab = getBrowser().addTab("chrome://fwb/content/historyBuck.xul");
    }

	/*
	while (windows.hasMoreElements()) {
		var theEM = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
		if (theEM.document.documentElement.getAttribute("windowtype") == windowType) {
			theEM.focus();
			needToOpen = false;
			break;
		}
	}if(needToOpen){
		const EMURL = "chrome://fwb/content/historybuck.xul";
		const EMFEATURES = "chrome, all, dialog=no, centerscreen";
		window.openDialog(EMURL, "", EMFEATURES);
	}*/
}