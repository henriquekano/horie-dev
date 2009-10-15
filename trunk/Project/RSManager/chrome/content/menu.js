function mouseOver(s) {
	var url = "chrome://rsmanager/skin/images/"+s+"_on.png";
	document.getElementById("menu_"+s+"_img").setAttribute("style", "list-style-image: url("+url+");");
	document.getElementById("menu_"+s+"_lbl").setAttribute("style", "color: #39B4FC;");
}

function mouseOut(s) {
	var url = "chrome://rsmanager/skin/images/"+s+".png";
	document.getElementById("menu_"+s+"_img").setAttribute("style", "list-style-image: url("+url+");");
	document.getElementById("menu_"+s+"_lbl").setAttribute("style", "color: #444;");
}

function clicked(s) {
	document.getElementById("content_frame").setAttribute("src", s+".xul");
}

function init() {
	Components.utils.import("resource://rsmanager-modules/preferences.jsm");
	checkPreferences();
	Components.utils.import("resource://rsmanager-modules/dbconnection.jsm");
	if(!checkDatabase()) {
		document.getElementById("content_frame").setAttribute("src", "install.xul");
	}
}

window.onload=init