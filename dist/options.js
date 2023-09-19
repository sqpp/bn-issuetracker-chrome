document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('bn-it-username');
    const itURLInput = document.getElementById('bn-it-url');
    const itAPIInput = document.getElementById('bn-it-api');
    const jiraAPIInput = document.getElementById('jiraAPI');
    const zendeskAPIInput = document.getElementById('zendeskAPI');
    const intercomAPIInput = document.getElementById('intercomAPI');
    const saveButton = document.getElementById('saveButton')
  
    // Load saved configuration values
    chrome.storage.local.get(['username', 'itURL', 'itAPI', 'jiraAPI', 'zendeskAPI', 'intercomAPI'], (result) => {
      usernameInput.value = result.username || '';
      itURLInput.value = result.itURL || '';
      itAPIInput.value = result.itAPI || '';
      jiraAPIInput.value = result.jiraAPI || '';
      zendeskAPIInput.value = result.zendeskAPI || '';
      intercomAPIInput.value = result.intercomAPI || '';
    });
    
    // Save configuration values
    saveButton.addEventListener('click', function() {
      const savedUsername = usernameInput.value;
      const savedItURL = itURLInput.value;
      const savedItAPI = itAPIInput.value;
      const savedJiraAPI = jiraAPIInput.value;
      const savedZendeskAPI = zendeskAPIInput.value;
      const savedIntercomAPI = intercomAPIInput.value;
      
      // Store configuration values
      chrome.storage.local.set({ 
        username: savedUsername, 
        itURL: savedItURL, 
        itAPI: savedItAPI, 
        jiraAPI: savedJiraAPI, 
        zendeskAPI: savedZendeskAPI, 
        intercomAPI: savedIntercomAPI 
      }, () => {
        console.log('Configuration saved.');
      });
    });
  });
  
  function getExtensionVersion() {
    const manifest = chrome.runtime.getManifest();
    return manifest.version || "N/A";
  }
  
  document.addEventListener("DOMContentLoaded", function () {
    const os = window.navigator.userAgentData.platform;
    const browserVersion = window.navigator.userAgent;
    chrome.permissions.getAll(permissions => {
      const extensionPermissions = permissions.permissions || [];
   
    console.log(window.navigator)
    const extensionVersion = getExtensionVersion();
    const extensionId = chrome.runtime.id;

    const debugInfo = {
      operatingSystem: os,
      browser: browserVersion,
      exstenionId: extensionId,
      extensionVersion: extensionVersion,
      permissions: extensionPermissions
    };
  
    const debugInfoElement = document.getElementById("debug-info");
    debugInfoElement.textContent = JSON.stringify(debugInfo, null, 2);
  })});
