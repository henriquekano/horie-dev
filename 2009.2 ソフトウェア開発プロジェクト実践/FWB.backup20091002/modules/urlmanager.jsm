var EXPORTED_SYMBOLS = ['HistoryBuckVisitManager'];

var Application = Components.classes["@mozilla.org/fuel/application;1"].getService(Components.interfaces.fuelIApplication);

var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
var mainWindow = wm.getMostRecentWindow("navigator:browser");
var browser = mainWindow.getBrowser();

var nextID=1;

var HistoryBuckVisitManager = {
  getNewID : function(){ return nextID++; },
  handleEvent : function(aEvent) {
    switch (aEvent.type) {
    case 'load':
      this.init();
      return;
    case 'unload':
      this.destroy();
      return;
    }
  },

  init : function() {
    browser.mTabContainer.addEventListener('select', self._pageTimer,false);
  },

  destroy : function() {
  },

  previousURL : '',
  startTime : 0,
  
  _pageTimer : function(){
    //HistoryBuckService.alert('hoge');
    var nowURL = this.selectedItem.linkedBrowser.contentWindow.location.href;
    //HistoryBuckService.alert('previous:'+HistoryBuckService.previousURL);
    //HistoryBuckService.alert('now:'+nowURL);
    
    if(HistoryBuckService.previousURL == nowURL) return;
    
    //新しいURLのタブを開いた時の処理を書く
    //HistoryBuckService.alert('new tab');
    HistoryBuckService._stopTimer(HistoryBuckService.previousURL);
    HistoryBuckService.previousURL = nowURL;
    HistoryBuckService.startTime = HistoryBuckService._getUnixTimeNow();
    //HistoryBuckService.alert(HistoryBuckService.viewTime);
  },
  
  _getUnixTimeNow : function(){
    return parseInt(new Date / 1000);
  },
  
  _getTotalTime : function(URL){
    //HistoryBuckService.alert('getTotalTime');
    return 0;
  },
  
  _stopTimer : function(URL) {
    var totalTime = HistoryBuckService._getTotalTime(URL);
    var nowTime = HistoryBuckService._getUnixTimeNow();
    var viewTime = (nowTime - HistoryBuckService.startTime);
    HistoryBuckService.alert('viewTime:'+viewTime);
    totalTime += viewTime;
    HistoryBuckService.startTime = 0;
    //HistoryBuckService.alert('stopTimer');
    //mainWindow.alert(this.viewTime);
    //alert(this.viewTime - new Date);
  },

  log : function(s) {
    //Application.console.log(s);
  },

  alert : function(s) {
    mainWindow.alert(s);
  },

};

mainWindow.addEventListener('load', HistoryBuckVisitManager, false);
mainWindow.addEventListener('unload', HistoryBuckVisitManager, false);