var rsmanager = {
	onLoad: function() {
		// initialization code
		this.initialized = true;
		this.strings = document.getElementById("rsmanager-strings");
	},
	
	open: function(e) {
		const kWindowMediatorContractID = "@mozilla.org/appshell/window-mediator;1";
		const kWindowMediatorIID = Components.interfaces.nsIWindowMediator;
		const kWindowMediator = Components.classes[kWindowMediatorContractID].getService(kWindowMediatorIID);
		var browserWindow = kWindowMediator.getMostRecentWindow("navigator:browser");
		var browser = browserWindow.getBrowser();
		var tab = browser.addTab("chrome://rsmanager/content/");
	}
};

window.addEventListener("load", rsmanager.onLoad, false);