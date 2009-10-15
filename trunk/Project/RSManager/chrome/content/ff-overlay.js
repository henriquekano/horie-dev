var rsmanagerOverlay = {
	open: function(e) {
		var needToOpen = true;
		var windowType = document.getElementById("stringbundle").getString("rsmanager_appName");
		
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
		if (needToOpen) getBrowser().selectedTab = getBrowser().addTab("chrome://rsmanager/content/rsmanager.xul");
	}
};