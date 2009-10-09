rsmanager.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ rsmanager.showFirefoxContextMenu(e); }, false);
};

rsmanager.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-rsmanager").hidden = gContextMenu.onImage;
};

window.addEventListener("load", rsmanager.onFirefoxLoad, false);
