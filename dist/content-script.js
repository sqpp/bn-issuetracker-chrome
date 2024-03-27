function extractIdFromUrl(url) {
  const intercomIdRegex = /\/conversation\/(\d+)/;
  const zendeskIdRegex = /\/tickets\/(\d+)/;
  const jiraIdRegex = /\/(\w+-\d+)$/;

  let id = null;

  if (intercomIdRegex.test(url)) {
    id = url.match(intercomIdRegex)[1];
  } else if (zendeskIdRegex.test(url)) {
    id = url.match(zendeskIdRegex)[1];
  } else if (jiraIdRegex.test(url)) {
    id = url.match(jiraIdRegex)[1];
  }

  return id;
}

function getAPIKey(type) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["jiraAPI", "zendeskAPI", "intercomAPI"], result => {
      switch (type) {
        case "jira":
          resolve(result.jiraAPI);
          break;
        case "zendesk":
          resolve(result.zendeskAPI);
          break;
        case "intercom":
          resolve(result.intercomAPI);
          break;
        default:
          reject(new Error("Unsupported API type"));
      }
    });
  });
}



function updateCurrentURLInInput() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentUrl = tabs[0].url;
    const id = extractIdFromUrl(currentUrl);
   
    document.getElementById("current-url").value = id ? id : "ID not found";
    chrome.storage.local.get(
      ["username", "itURL", "itAPI", "jiraAPI", "zendeskAPI", "intercomAPI"],
      result => {
        if (currentUrl.includes("intercom")) {
          fetchDataFromPlatform(
            "intercom",
            id,
            result.intercomAPI,
            result.itURL,
            result.itAPI,
            currentUrl
          );
        } else if (currentUrl.includes("atlassian")) {
          fetchDataFromPlatform(
            "jira",
            id,
            result.jiraAPI,
            result.itURL,
            result.itAPI,
            currentUrl
          );
        } else if (currentUrl.includes("zendesk")) {
          fetchDataFromPlatform(
            "zendesk",
            id,
            result.zendeskAPI,
            result.itURL,
            result.itAPI,
            currentUrl
          );
        }
      }
    );
  });
}



async function sendInternalNote(platform, username, ticketId, userId, category, internalNote, isEscalated) {
  let platformNoteAPI;
  let data;
  let apiKey;
  let methodType;
  const currentDate = new Date();
  // Determine the API URL and data structure based on the platform
  switch(platform) {
      case "Zendesk":
          platformNoteAPI = `https://bitninjatechnology.zendesk.com/api/v2/tickets/${ticketId}`;
          data = {
            "ticket": {
              "updated_stamp": currentDate,
              "safe_update": true,
              "comment": {
                "public": false,
                "uploads": [],
                "html_body": `//Agent @${username} added Record to IssueTracker API <br>
                <strong>userid:</strong> ${userId} <br>
                <strong>category:</strong> ${category} <br>
                <strong>Ticket:</strong> [${ticketId}] - internalNote: "${internalNote}" <br>
                <strong>escalated:</strong> ${isEscalated ? 'Yes' : 'No'}`,
              },
             
            }
          };          
          methodType = "PUT",
          zendeskAPI = await getAPIKey("zendesk") 
          credentials = `supportteam@bitninja.io/token:${zendeskAPI}`;
          encodedCredentials = btoa(credentials);
          apiKey = `Basic ${encodedCredentials}`;
          
          break;
      case "Jira":
          platformNoteAPI = `https://bitninjaio.atlassian.net/rest/api/2/issue/${ticketId}/comment`;
          data ={
            "body": `//Agent @${username} added Record to IssueTracker API\n<strong>userid:</strong> ${userId}\n<strong>category:</strong> ${category}\n<strong>Ticket:</strong> [${ticketId}] - internalNote: "${internalNote}"\n<strong>escalated:</strong> ${isEscalated ? 'Yes' : 'No'}`,
            "properties": [
                {
                    "key": "sd.public.comment",
                    "value": {
                        "internal": true
                    }
                }
            ]
        }
          jiraAPI = await getAPIKey("jira")
          credentials = `${username}@bitninja.io:${jiraAPI}`;
          encodedCredentials = btoa(credentials);
          apiKey = encodedCredentials;
          methodType = "POST"
          break;
      case "Intercom":
          platformNoteAPI = `https://api.intercom.io/conversations/${ticketId}/reply`;
          data = {
            "message_type": "note",
            "type": "admin",
            "admin_id": "4554314",
            "body": `//Agent @${username} added Record to IssueTracker API
            <strong>userid:</strong> ${userId}
            <strong>category:</strong> ${category}
            <strong>Ticket:</strong> [${ticketId}] - internalNote: "${internalNote}"
            <strong>escalated:</strong> ${isEscalated ? 'Yes' : 'No'}`
            }
          methodType = "POST"
          intercomAPI = await getAPIKey("intercom")
          apiKey = `Bearer ${intercomAPI}`;
          break;
      default:
          console.error("Unsupported platform for internal note.");
          return; 
  }

  try {
      const response = await fetch(platformNoteAPI, {
          method: methodType,
          headers: {
              "Content-Type": "application/json",
              "Accept":  "application/json",
              "Authorization": apiKey
          },
          body: JSON.stringify(data)
      });

      if (response.ok) {
          console.log(`Internal note successfully sent to ${platform}`);
          // Handle successful response
      } else {
          console.error(`Failed to send internal note to ${platform}:`, response.statusText);
          // Handle error
      }
  } catch (error) {
      console.error(`Error sending internal note to ${platform}:`, error);
      // Handle error
  }
}



updateCurrentURLInInput();
document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("myForm");
  const errorMessage = document.getElementById("error-message");
  const successMessage = document.getElementById("success-message");

  form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const ticketId = document.getElementById("current-url").value;
    const userId = document.getElementById("userID").value;
    const category = document.getElementById("cat").value;
    const isTrialUser = document.getElementById("Trial").checked;
    const notes = document.getElementById("notes").value;
    const issueType = document.getElementById("DevOrSupp").value;
    const isEscalated = document.getElementById("Escalated").checked;

    const isIssueChecked = document.querySelector('input[name="option"]:checked');
const questionOrIssue = isIssueChecked ? "issue" : "question";

    if (
      !ticketId ||
      !userId ||
      !category ||
      !notes ||
      !questionOrIssue
    ) {
      errorMessage.classList.remove("hidden");
      errorMessage.textContent = "Please fill out all required fields.";
      return; // Exit the function without submitting the form
    }
    chrome.storage.local.get(["itURL", "itAPI", "username"], async ({ itURL, itAPI, username }) => {
      errorMessage.textContent = ""; // Clear any previous error message
      successMessage.textContent = "";
      chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
        const currentUrl = tabs[0].url;
        let platformLink;
        let platform;

        if (currentUrl.includes("bitninjatechnology.zendesk.com")) {
          platformLink = "deskLink";
          platform = "Zendesk";
        } else if (currentUrl.includes("bitninjaio.atlassian.net")) {
          platformLink = "jiraLink";
          platform = "Jira";
        } else if (currentUrl.includes("intercom.com")) {
          platformLink = "intercomLink";
          platform = "Intercom";
        }

        
        const data = {
          uid: userId,
          agentName: username,
          module: category,
          platform: platform,
          ticketid: ticketId,
          solved: issueType,
          platformlink: platformLink,
          note: notes,
          escalated: isEscalated,
          agentVer: null,
          qori: questionOrIssue,
          inTrial: isTrialUser ? 1 : 0,
        };

        try {
          // Get values from chrome.storage.local
          const response = await fetch(`${itURL}/issue?key=${itAPI}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
          });

          if (response.ok) {
            const responseData = await response.json();
            successMessage.classList.remove("hidden");
            successMessage.textContent = `Success! C: ${response.status}`;
            sendInternalNote(data.platform, data.agentName, ticketId, data.uid, data.module, data.note, isEscalated)
           
          } else {
            console.error("API request failed:", response.statusText);
            errorMessage.classList.remove("hidden");
            errorMessage.textContent = `Error! C: ${response.status}`;

            //
          }
        } catch (error) {
          console.error("Error:", error);
          // Handle error
        }
      });
    });
  });
});


function getNestedProperty(obj, path) {
  const properties = path.split(".");
  let value = obj;

  for (const prop of properties) {
    value = value[prop];
    if (value === undefined) {
      break;
    }
  }

  return value;
}

async function fetchDataFromPlatform(platform, id, apiKey, apiURL, itkey) {
  try {
    let apiUrl;
    let userIdApiUrl;
    let jsonObject;
    let userId;
    let data;

    switch (platform) {
      case "zendesk":
        // Zendesk
        apiUrl = `https://bitninjatechnology.zendesk.com/api/v2/tickets/${id}`;
        const credentials = `supportteam@bitninja.io/token:${apiKey}`;
        const encodedCredentials = btoa(credentials);
        apiKey = `Basic ${encodedCredentials}`;
        jsonObject = "ticket.via.source.from.address";
        break;
      // JIRA
      case "jira":
        apiUrl = `https://bitninjaio.atlassian.net/rest/api/3/issue/${id}`;
        apiKey = `Basic ${apiKey}`;
        jsonObject = "fields.reporter.emailAddress";
        break;
      case "intercom":
        apiUrl = `https://api.intercom.io/conversations/${id}`;
        apiKey = `Bearer ${apiKey}`;
        jsonObject = "email";
        break;
      default:
        throw new Error("Invalid platform");
    }

    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: apiKey
      }
    };

    const response = await fetch(apiUrl, options);
    data = await response.json();

    let reporterEmailAddress;

    if (platform === "zendesk") {
      reporterEmailAddress = getNestedProperty(data, jsonObject);
    } else if (platform === "jira") {
      reporterEmailAddress = getNestedProperty(data, jsonObject);
    } else if (platform === "intercom") {
      if (data) {
        const contactId = data.contacts.contacts[0].id;
        if (contactId) {
          const contactUrl = `https://api.intercom.io/contacts/${contactId}`;
          const contactResponse = await fetch(contactUrl, options);
          const contactData = await contactResponse.json();
          userId = contactData.external_id;
          reporterEmailAddress = contactData.email;
          document.getElementById("userID").value = userId
            ? userId
            : "ID not found";
        } else {
          console.log("Contact ID not available");
          reporterEmailAddress = ""; // Set a default value
        }
      } else {
        console.log("Conversation data not available");
      }
    }

    if (reporterEmailAddress) {
      userIdApiUrl = `${apiURL}/fetchECData?key=${itkey}&email=${encodeURIComponent(
        reporterEmailAddress
      )}`;
      const userIdResponse = await fetch(userIdApiUrl, options);
      const userIdData = await userIdResponse.json();
      const trialCheckbox = document.getElementById("Trial");
      trialCheckbox.checked = true; // To check the checkbox
      trialCheckbox.checked = false; // To uncheck the checkbox
      document.getElementById("userID").value = userIdData.result[0].user_id
        ? userIdData.result[0].user_id
        : "ID not found";
      if (userIdData.result[0].license === "trial") {
        trialCheckbox.checked = true;
      } else {
        trialCheckbox.checked = false;
      }
    } else {
      console.log("Reporter email address not available");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}
