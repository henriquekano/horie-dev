function backup() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, "Save to file", nsIFilePicker.modeGetFolder);
	fp.appendFilter("Database Files", "*.db");
	var res = fp.show();
	if(res == nsIFilePicker.returnOK) {
		var dbFile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsIFile);
		dbFile.append("rsmanager.db");
		var today = new Date();
		dbFile.copyTo(fp.file, "rsmanager" + (today.getYear()+1900) + "-" + (today.getMonth()+1) + "-" + today.getDate() + ".db");
		return true;
	}
	return false;
}

function restore() {
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
		return true;
	}
	return false;
}