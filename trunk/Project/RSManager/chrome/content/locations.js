var dbConn = null;
var maxCityID = null;
var maxRegionID = null;

function init() {
	hideAllTextboxes();
	Components.utils.import("resource://rsmanager-modules/dbconnection.jsm");
	dbConn = createConnection();
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
	var statement = dbConn.createStatement("SELECT * FROM LocProvinces");
	try {
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.ProvinceID);
			listitem.setAttribute("label", statement.row.ProvinceName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
		}
	} finally {
		statement.reset();
	}
	listbox.selectedIndex = 0;
}
function populateCities() {
	var listbox = document.getElementById("listbox_cities");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var statement = dbConn.createStatement("SELECT * FROM LocCities WHERE ProvinceID = :provinceID ORDER BY CityName");
	statement.params.provinceID = document.getElementById("listbox_provinces").selectedItem.value;
	try {
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.CityID);
			listitem.setAttribute("label", statement.row.CityName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
		}
	} finally {
		statement.reset();
	}
	listbox.selectedIndex = 0;
	displayAddCityTextbox(false);
	displayEditCityTextbox(false);
}
function populateRegions() {
	var listbox = document.getElementById("listbox_regions");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var statement = dbConn.createStatement("SELECT * FROM LocRegions WHERE CityID = :cityID ORDER BY RegionName");
	statement.params.cityID = document.getElementById("listbox_cities").selectedItem.value;
	try {
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.RegionID);
			listitem.setAttribute("label", statement.row.RegionName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
		}
	} finally {
		statement.reset();
	}
	listbox.selectedIndex = 0;
	displayAddRegionTextbox(false);
	displayEditRegionTextbox(false);
}

function hideAllTextboxes() {
	displayAddCityTextbox(false);
	displayAddRegionTextbox(false);
	document.getElementById("spacer_editcity").setAttribute("style", "display: none;");
	document.getElementById("label_editcity").setAttribute("style", "display: none;");
	document.getElementById("texbox_editcity").setAttribute("style", "display: none;");
	document.getElementById("buttons_editcity").setAttribute("style", "display: none;");
	document.getElementById("spacer_editregion").setAttribute("style", "display: none;");
	document.getElementById("label_editregion").setAttribute("style", "display: none;");
	document.getElementById("texbox_editregion").setAttribute("style", "display: none;");
	document.getElementById("buttons_editregion").setAttribute("style", "display: none;");
}
function displayAddCityTextbox(display) {
	document.getElementById("spacer_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("label_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addcity").setAttribute("value", "");
	document.getElementById("buttons_addcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
}
function displayEditCityTextbox(display) {
	var listbox = document.getElementById("listbox_cities");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("spacer_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("label_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_editcity").setAttribute("value", listbox.selectedItem.label);
		document.getElementById("buttons_editcity").setAttribute("style", "display: " + (display?"''":"none") + ";");
	}
}
function displayAddRegionTextbox(display) {
	document.getElementById("spacer_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("label_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addregion").setAttribute("value", "");
	document.getElementById("buttons_addregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
}
function displayEditRegionTextbox(display) {
	var listbox = document.getElementById("listbox_regions");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("spacer_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("label_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_editregion").setAttribute("value", listbox.selectedItem.label);
		document.getElementById("buttons_editregion").setAttribute("style", "display: " + (display?"''":"none") + ";");
	}
}
function updateEditCityTextbox() {
	var listbox = document.getElementById("listbox_cities");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("texbox_editcity").setAttribute("value", listbox.selectedItem.label);
	}
}
function updateEditRegionTextbox() {
	var listbox = document.getElementById("listbox_regions");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("texbox_editregion").setAttribute("value", listbox.selectedItem.label);
	}
}

function addCity() {
	maxCityID++;
	var statement = dbConn.createStatement("INSERT INTO LocCities VALUES (?1, ?2, ?3)");
	statement.bindInt32Parameter(0, maxCityID);
	statement.bindInt32Parameter(1, document.getElementById("listbox_provinces").selectedItem.value);
	statement.bindUTF8StringParameter(2, document.getElementById("texbox_addcity").value);
	statement.execute();
	populateCities();
}
function editCity() {
	var statement = dbConn.createStatement("UPDATE LocCities SET CityName = ?1 WHERE CityID = ?2");
	statement.bindUTF8StringParameter(0, document.getElementById("texbox_editcity").value);
	statement.bindInt32Parameter(1, document.getElementById("listbox_cities").selectedItem.value);
	statement.execute();
	populateCities();
}
function deleteCity() {
	var statement = dbConn.createStatement("DELETE FROM LocCities WHERE CityID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_cities").selectedItem.value);
	statement.execute();
	populateCities();
}
function addRegion() {
	maxRegionID++;
	var statement = dbConn.createStatement("INSERT INTO LocRegions VALUES (?1, ?2, ?3)");
	statement.bindInt32Parameter(0, maxRegionID);
	statement.bindInt32Parameter(1, document.getElementById("listbox_cities").selectedItem.value);
	statement.bindUTF8StringParameter(2, document.getElementById("texbox_addregion").value);
	statement.execute();
	populateRegions();
}
function editRegion() {
	var statement = dbConn.createStatement("UPDATE LocRegions SET RegionName = ?1 WHERE RegionID = ?2");
	statement.bindUTF8StringParameter(0, document.getElementById("texbox_editregion").value);
	statement.bindInt32Parameter(1, document.getElementById("listbox_regions").selectedItem.value);
	statement.execute();
	populateRegions();
}
function deleteRegion() {
	var statement = dbConn.createStatement("DELETE FROM LocRegions WHERE RegionID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_regions").selectedItem.value);
	statement.execute();
	populateRegions();
}

window.onload=init;
window.onunload=closeConnection;
