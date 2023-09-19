function getCurrentTabUrl(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    var url = tab.url;
    callback(url);
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "get_current_url") {
    getCurrentTabUrl(function (url) {
      sendResponse({ url: url });
    });
    return true; 
  }
});

