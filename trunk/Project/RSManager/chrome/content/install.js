function install() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, "Select a file", nsIFilePicker.modeOpen);
	fp.appendFilter("Database Files", "*.db");
	var res = fp.show();
	if(res == nsIFilePicker.returnOK) {
		var oldFile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsIFile);
		oldFile.append("rsmanager.db");
		oldFile.remove(false);
		fp.file.copyTo(Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsIFile), "rsmanager.db");
		alert("Installation successful!");
		location.href = "main.xul";
	} else {
		alert("Please try again.");
	}
}