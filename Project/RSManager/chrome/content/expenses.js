Components.utils.import("resource://rsmanager-modules/dbconnection.jsm");
Components.utils.import("resource://rsmanager-modules/preferences.jsm");

var dbConn = null;
var maxExpenseID = null;
var defaultProvinceID = null;
var defaultCityID = null;
var defaultRegionID = null;
var stringbundle = null;

function init() {
	stringbundle = document.getElementById("stringbundle");
	dbConn = createConnection();
	loadDefaultLocation();
	populateTypes();
	populateProvinces();
	populateExpenses();
	
	var statement = dbConn.createStatement("SELECT max(ExpenseID) as MaxExpenseID FROM Expenses");
	statement.executeStep();
	maxExpenseID = statement.row.MaxExpenseID;
	statement.reset();
}
function closeConnection() {
	dbConn.close();
}

function populateTypes() {
	var menulist = document.getElementById("menulist_type");
	var menupopup = document.createElement("menupopup");
	menulist.removeAllItems();
	menulist.appendChild(menupopup);
	var statement = dbConn.createStatement("SELECT * FROM ExpenseTypes ORDER BY ExpenseTypeName");
	try {
		while (statement.executeStep()) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", statement.row.ExpenseTypeID);
			menuitem.setAttribute("label", statement.row.ExpenseTypeName);
			menuitem.setAttribute("class", "form_menulist");
			menupopup.appendChild(menuitem);
		}
	} finally {
		statement.reset();
	}
	menulist.selectedIndex = 0;
}
function populateSubTypes() {
	var menulist = document.getElementById("menulist_subtype");
	var menupopup = document.createElement("menupopup");
	menulist.removeAllItems();
	menulist.appendChild(menupopup);
	var statement = dbConn.createStatement("SELECT * FROM ExpenseSubTypes WHERE ExpenseTypeID = :typeID ORDER BY ExpenseSubTypeName");
	statement.params.typeID = document.getElementById("menulist_type").selectedItem.value;
	try {
		while (statement.executeStep()) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", statement.row.ExpenseSubTypeID);
			menuitem.setAttribute("label", statement.row.ExpenseSubTypeName);
			menuitem.setAttribute("class", "form_menulist");
			menupopup.appendChild(menuitem);
		}
	} finally {
		statement.reset();
	}
	menulist.selectedIndex = 0;
}
function populateProvinces() {
	var menulist = document.getElementById("menulist_province");
	var menupopup = document.createElement("menupopup");
	menulist.removeAllItems();
	menulist.appendChild(menupopup);
	var defaultIndex = 0;
	var statement = dbConn.createStatement("SELECT * FROM LocProvinces ORDER BY ProvinceName");
	try {
		while (statement.executeStep()) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", statement.row.ProvinceID);
			menuitem.setAttribute("label", statement.row.ProvinceName);
			menuitem.setAttribute("class", "form_menulist");
			menupopup.appendChild(menuitem);
			if(defaultProvinceID==statement.row.ProvinceID) defaultIndex = menulist.itemCount-1;
		}
	} finally {
		statement.reset();
	}
	menulist.selectedIndex = defaultIndex;
}
function populateCities() {
	var menulist = document.getElementById("menulist_city");
	var menupopup = document.createElement("menupopup");
	menulist.removeAllItems();
	menulist.appendChild(menupopup);
	var defaultIndex = 0;
	var statement = dbConn.createStatement("SELECT * FROM LocCities WHERE ProvinceID = ?1 ORDER BY CityName");
	try {
		statement.bindInt32Parameter(0, document.getElementById("menulist_province").selectedItem.value);
		while (statement.executeStep()) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", statement.row.CityID);
			menuitem.setAttribute("label", statement.row.CityName);
			menuitem.setAttribute("class", "form_menulist");
			menupopup.appendChild(menuitem);
			if(defaultCityID==statement.row.CityID) defaultIndex = menulist.itemCount-1;
		}
	} finally {
		statement.reset();
	}
	menulist.selectedIndex = defaultIndex;
}
function populateRegions() {
	var menulist = document.getElementById("menulist_region");
	var menupopup = document.createElement("menupopup");
	menulist.removeAllItems();
	menulist.appendChild(menupopup);
	var defaultIndex = 0;
	var statement = dbConn.createStatement("SELECT * FROM LocRegions WHERE CityID = ?1 ORDER BY RegionName");
	try {
		statement.bindInt32Parameter(0, document.getElementById("menulist_city").selectedItem.value);
		while (statement.executeStep()) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", statement.row.RegionID);
			menuitem.setAttribute("label", statement.row.RegionName);
			menuitem.setAttribute("class", "form_menulist");
			menupopup.appendChild(menuitem);
			if(defaultRegionID==statement.row.RegionID) defaultIndex = menulist.itemCount-1;
		}
	} finally {
		statement.reset();
	}
	menulist.selectedIndex = defaultIndex;
}

function addExpense() {
	if(document.getElementById("menulist_subtype").selectedItem == null) {
		alert(stringbundle.getString("expenses_ChooseType")); return;
	}
	if(document.getElementById("menulist_region").selectedItem == null) {
		alert(stringbundle.getString("locations_ChooseRegion")); return;
	}
	
	var expDate = document.getElementById("datepicker_add").dateValue;
	var expType = document.getElementById("menulist_subtype").selectedItem.value;
	var expDescription = document.getElementById("textbox_description").value;
	var expLocation = document.getElementById("menulist_region").selectedItem.value;
	var expThirdParty = document.getElementById("textbox_thirdparty").value;
	var expValue = document.getElementById("textbox_value").value;
	
	maxExpenseID++;
	var statement = dbConn.createStatement("INSERT INTO Expenses VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
	statement.bindInt32Parameter(0, maxExpenseID);
	statement.bindUTF8StringParameter(1, expDate.getFullYear()+"-"+(expDate.getMonth()+1)+"-"+expDate.getDate()+" 12:00:00");
	statement.bindInt32Parameter(2, expType);
	statement.bindUTF8StringParameter(3, expDescription);
	statement.bindInt32Parameter(4, expLocation);
	statement.bindUTF8StringParameter(5, expThirdParty);
	statement.bindInt32Parameter(6, expValue);
	statement.execute();
	
	populateExpenses();
	clearForm();
}
function populateExpenses() {
	var treechildren = document.getElementById("tree_children");
	
	var statement = dbConn.createStatement("SELECT t1.ExpenseTypeName || ' > ' || t2.ExpenseSubTypeName Type,\
		e.ExpenseDescription Description,\
		l1.ProvinceName || ' > ' || l2.CityName || ' > ' || l3.RegionName Location,\
		e.ThirdPartyName ThirdParty,\
		e.Value Value\
		FROM Expenses e, ExpenseTypes t1, ExpenseSubTypes t2, LocProvinces l1, LocCities l2, LocRegions l3\
		WHERE e.ExpenseDate = ?1 AND e.ExpenseTypeID = t2.ExpenseSubTypeID AND t1.ExpenseTypeID = t2.ExpenseTypeID AND\
			e.LocationID = l3.RegionID AND l2.CityID = l3.CityID AND l1.ProvinceID = l2.ProvinceID\
		ORDER BY e.ExpenseID");
	try {
		var expDate = document.getElementById("datepicker_filter").dateValue;
		statement.bindInt32Parameter(0, expDate.getFullYear()+"-"+(expDate.getMonth()+1)+"-"+expDate.getDate()+" 12:00:00");
		while (statement.executeStep()) {
			var treeitem = document.createElement("treeitem");
			var treerow = document.createElement("treerow");
			treechildren.appendChild(treeitem);
			treeitem.appendChild(treerow);
			
			var treecellType = document.createElement("trecell");
			treecellType.setAttribute("label", statement.row.Type);
			treerow.appendChild(treecellType);
			var treecellDescription = document.createElement("trecell");
			treecellDescription.setAttribute("label", statement.row.Description);
			treerow.appendChild(treecellDescription);
			var treecellLocation = document.createElement("trecell");
			treecellLocation.setAttribute("label", statement.row.Location);
			treerow.appendChild(treecellLocation);
			var treecellThirdParty = document.createElement("trecell");
			treecellThirdParty.setAttribute("label", statement.row.ThirdParty);
			treerow.appendChild(treecellThirdParty);
			var treecellValue = document.createElement("trecell");
			treecellValue.setAttribute("label", statement.row.Value);
			treerow.appendChild(treecellValue);
		}
	} finally {
		statement.reset();
	}
}

function loadDefaultLocation() {
	var defaultLoc = getDefaultLocation(dbConn);
	if(defaultLoc==null) {
		defaultProvinceID = defaultCityID = defaultRegionID = null;
	} else {
		defaultProvinceID = defaultLoc[0];
		defaultCityID = defaultLoc[2];
		defaultRegionID = defaultLoc[4];
	}
}
function clearForm() {
	populateTypes();
	populateProvinces();
	document.getElementById("textbox_description").value = "";
	document.getElementById("textbox_thirdparty").value = "";
	document.getElementById("textbox_value").value = "";
}

window.onload=init;
window.onunload=closeConnection;