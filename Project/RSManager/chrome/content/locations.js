Components.utils.import("resource://rsmanager-modules/dbconnection.jsm");
Components.utils.import("resource://rsmanager-modules/preferences.jsm");

var dbConn = null;
var maxCityID = null;
var maxRegionID = null;
var defaultProvinceID = null;
var defaultCityID = null;
var defaultRegionID = null;

function init() {
	hideAllTextboxes();
	dbConn = createConnection();
	loadDefaultLocation();
	populateProvinces();
	
	var cityStatement = dbConn.createStatement("SELECT max(CityID) as MaxCityID FROM LocCities");
	cityStatement.executeStep();
	maxCityID = cityStatement.row.MaxCityID;
	cityStatement.reset();
	var regionStatement = dbConn.createStatement("SELECT max(RegionID) as MaxRegionID FROM LocRegions");
	regionStatement.executeStep();
	maxRegionID = regionStatement.row.MaxRegionID;
	regionStatement.reset();
}
function closeConnection() {
	dbConn.close();
}

function populateProvinces() {
	var listbox = document.getElementById("listbox_provinces");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var defaultIndex = 0;
	var statement = dbConn.createStatement("SELECT * FROM LocProvinces ORDER BY ProvinceName");
	try {
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.ProvinceID);
			listitem.setAttribute("label", statement.row.ProvinceName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
			if(defaultProvinceID==statement.row.ProvinceID) defaultIndex = listbox.getRowCount()-1;
		}
	} finally {
		statement.reset();
	}
	listbox.ensureIndexIsVisible(defaultIndex);
	listbox.selectedIndex = defaultIndex;
}
function populateCities() {
	var listbox = document.getElementById("listbox_cities");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var defaultIndex = 0;
	var statement = dbConn.createStatement("SELECT * FROM LocCities WHERE ProvinceID = ?1 ORDER BY CityName");
	try {
		statement.bindInt32Parameter(0, document.getElementById("listbox_provinces").selectedItem.value);
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.CityID);
			listitem.setAttribute("label", statement.row.CityName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
			if(defaultCityID==statement.row.CityID) defaultIndex = listbox.getRowCount()-1;
		}
	} finally {
		statement.reset();
	}
	displayAddCityTextbox(false);
	displayEditCityTextbox(false);
	listbox.ensureIndexIsVisible(defaultIndex);
	listbox.selectedIndex = defaultIndex;
}
function populateRegions() {
	var listbox = document.getElementById("listbox_regions");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var defaultIndex = 0;
	var statement = dbConn.createStatement("SELECT * FROM LocRegions WHERE CityID = ?1 ORDER BY RegionName");
	try {
		statement.bindInt32Parameter(0, document.getElementById("listbox_cities").selectedItem.value);
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.RegionID);
			listitem.setAttribute("label", statement.row.RegionName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
			if(defaultRegionID==statement.row.RegionID) defaultIndex = listbox.getRowCount()-1;
		}
	} finally {
		statement.reset();
	}
	listbox.ensureIndexIsVisible(defaultIndex);
	listbox.selectedIndex = defaultIndex;
	loadDefaultLocation();
	enableDefaultButton();
	displayAddRegionTextbox(false);
	displayEditRegionTextbox(false);
}

function enableDefaultButton() {
	var empty = document.getElementById("listbox_regions").getRowCount() == 0;
	var url = "chrome://rsmanager/skin/images/set" + (empty?"_off":"") + ".png";
	document.getElementById("button_setdefault").setAttribute("style", "list-style-image: url("+url+");");
}
function hideAllTextboxes() {
	displayAddCityTextbox(false);
	displayAddRegionTextbox(false);
	document.getElementById("spacer_editcity").setAttribute("style", "display: none;");
	document.getElementById("label_editcity").setAttribute("style", "display: none;");
	document.getElementById("textbox_editcity").setAttribute("style", "display: none;");
	document.getElementById("buttons_editcity").setAttribute("style", "display: none;");
	document.getElementById("spacer_editregion").setAttribute("style", "display: none;");
	document.getElementById("label_editregion").setAttribute("style", "display: none;");
	document.getElementById("textbox_editregion").setAttribute("style", "display: none;");
	document.getElementById("buttons_editregion").setAttribute("style", "display: none;");
}
function displayAddCityTextbox(display) {
	document.getElementById("spacer_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("label_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("textbox_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("textbox_addcity").value = "";
	document.getElementById("buttons_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
}
function displayEditCityTextbox(display) {
	var listbox = document.getElementById("listbox_cities");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("spacer_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("label_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("textbox_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("textbox_editcity").setAttribute("value", listbox.selectedItem.label);
		document.getElementById("buttons_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	}
}
function displayAddRegionTextbox(display) {
	if(document.getElementById("listbox_cities").getRowCount() == 0) { display = false; }
	document.getElementById("spacer_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("label_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("textbox_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("textbox_addregion").value = "";
	document.getElementById("buttons_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
}
function displayEditRegionTextbox(display) {
	if(document.getElementById("listbox_cities").getRowCount() == 0) { display = false; }
	var listbox = document.getElementById("listbox_regions");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("spacer_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("label_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("textbox_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("textbox_editregion").setAttribute("value", listbox.selectedItem.label);
		document.getElementById("buttons_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	}
}
function updateEditCityTextbox() {
	var listbox = document.getElementById("listbox_cities");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("textbox_editcity").setAttribute("value", listbox.selectedItem.label);
	}
}
function updateEditRegionTextbox() {
	var listbox = document.getElementById("listbox_regions");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("textbox_editregion").setAttribute("value", listbox.selectedItem.label);
	}
}

function addCity() {
	maxCityID++;
	var statement = dbConn.createStatement("INSERT INTO LocCities VALUES (?1, ?2, ?3)");
	statement.bindInt32Parameter(0, maxCityID);
	statement.bindInt32Parameter(1, document.getElementById("listbox_provinces").selectedItem.value);
	statement.bindUTF8StringParameter(2, document.getElementById("textbox_addcity").value);
	statement.execute();
	populateCities();
}
function editCity() {
	var statement = dbConn.createStatement("UPDATE LocCities SET CityName = ?1 WHERE CityID = ?2");
	statement.bindUTF8StringParameter(0, document.getElementById("textbox_editcity").value);
	statement.bindInt32Parameter(1, document.getElementById("listbox_cities").selectedItem.value);
	statement.execute();
	populateCities();
}
function deleteCity() {
	var statement = dbConn.createStatement("DELETE FROM LocCities WHERE CityID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_cities").selectedItem.value);
	statement.execute();
	var statement = dbConn.createStatement("DELETE FROM LocRegions WHERE CityID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_cities").selectedItem.value);
	statement.execute();
	loadDefaultLocation();
	populateCities();
}
function addRegion() {
	maxRegionID++;
	var statement = dbConn.createStatement("INSERT INTO LocRegions VALUES (?1, ?2, ?3)");
	statement.bindInt32Parameter(0, maxRegionID);
	statement.bindInt32Parameter(1, document.getElementById("listbox_cities").selectedItem.value);
	statement.bindUTF8StringParameter(2, document.getElementById("textbox_addregion").value);
	statement.execute();
	populateRegions();
}
function editRegion() {
	var statement = dbConn.createStatement("UPDATE LocRegions SET RegionName = ?1 WHERE RegionID = ?2");
	statement.bindUTF8StringParameter(0, document.getElementById("textbox_editregion").value);
	statement.bindInt32Parameter(1, document.getElementById("listbox_regions").selectedItem.value);
	statement.execute();
	populateRegions();
}
function deleteRegion() {
	var statement = dbConn.createStatement("DELETE FROM LocRegions WHERE RegionID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_regions").selectedItem.value);
	statement.execute();
	loadDefaultLocation();
	populateRegions();
}

function saveDefaultLocation() {
	if(document.getElementById("listbox_regions").getRowCount() != 0) {
		var defaultRegionId = document.getElementById("listbox_regions").value;
		setDefaultLocation(defaultRegionId);
		loadDefaultLocation();
	}
}
function loadDefaultLocation() {
	var stringbundle = document.getElementById("stringbundle");
	var defaultLoc = getDefaultLocation(dbConn);
	if(defaultLoc==null) {
		document.getElementById("label_setdefault").setAttribute("value", stringbundle.getString("locations_NoValueDefined"));
		defaultProvinceID = defaultCityID = defaultRegionID = null;
	} else {
		var labelString = defaultLoc[1] + " > " + defaultLoc[3] + " > " + defaultLoc[5];
		document.getElementById("label_setdefault").setAttribute("value", labelString);
		defaultProvinceID = defaultLoc[0];
		defaultCityID = defaultLoc[2];
		defaultRegionID = defaultLoc[4];
	}
}

window.onload=init;
window.onunload=closeConnection;