var EXPORTED_SYMBOLS = ["checkPreferences", "getDefaultLocation", "setDefaultLocation"];

function checkPreferences() {
	var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.rsmanager.");
	try { prefs.getIntPref("defaultlocation"); }
	catch(e) { prefs.setIntPref("defaultlocation", -1); }
}

function getDefaultLocation(dbConn) {
	var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.rsmanager.");
	var deflocId = prefs.getIntPref("defaultlocation");
	
	var statement = dbConn.createStatement("SELECT p.ProvinceName pName, c.CityName cName, r.RegionName rName,\
		p.ProvinceID pID, c.CityID cID, r.RegionID rID\
		FROM LocProvinces p, LocCities c, LocRegions r\
		WHERE r.RegionID = :regionID AND r.CityID = c.CityID AND c.ProvinceID = p.ProvinceID");
	statement.params.regionID = deflocId;
	if(statement.executeStep()) {
		var pName = statement.row.pName;
		var cName = statement.row.cName;
		var rName = statement.row.rName;
		var pID = statement.row.pID;
		var cID = statement.row.cID;
		var rID = statement.row.rID;
		statement.reset();
		return [pID, pName, cID, cName, rID, rName];
	} else {
		statement.reset();
		return null;
	}
}

function setDefaultLocation(regionID) {
	var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.rsmanager.");
	prefs.setIntPref("defaultlocation", regionID);
}