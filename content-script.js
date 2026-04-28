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
    const platformSelect = document.getElementById("platform-select");
    const selectedPlatform = platformSelect.value;
    
    if (selectedPlatform === "slack") {
      // For manual Slack input, clear the ticket ID field
      document.getElementById("current-url").value = "";
      return;
    }
    
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
            "body": `//Agent @${username} added Record to IssueTracker API <br>
            <strong>userid:</strong> ${userId} <br>
            <strong>category:</strong> ${category} <br>
            <strong>Ticket:</strong> [${ticketId}] - internalNote: "${internalNote}" <br>
            <strong>escalated:</strong> ${isEscalated ? 'Yes' : 'No'}`
            }
          methodType = "POST"
          intercomAPI = await getAPIKey("intercom")
          apiKey = `Bearer ${intercomAPI}`;
          break;
      default:
          console.error("Unsupported platform for internal note.");
          return; // Exit function if platform is not supported
  }

  try {
      const response = await fetch(platformNoteAPI, {
          method: methodType,
          headers: {
              "Content-Type": "application/json",
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
  const openManagementBtn = document.getElementById("open-management");
  const form = document.getElementById("myForm");
  const submitBtn = document.getElementById("submit");
  const errorMessage = document.getElementById("error-message");
  const successMessage = document.getElementById("success-message");
  const platformSelect = document.getElementById("platform-select");

  const setSubmitting = (isSubmitting) => {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.value = isSubmitting ? "Sending..." : "Send";
    submitBtn.classList.toggle("opacity-60", isSubmitting);
    submitBtn.classList.toggle("cursor-not-allowed", isSubmitting);
  };

  if (openManagementBtn) {
    openManagementBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("management.html") });
    });
  }
  
  // Add event listener for platform selection
  platformSelect.addEventListener("change", function() {
    updateCurrentURLInInput();
  });

  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    console.log("Form submitted");

    const userId = document.getElementById("userID").value;
    const category = document.getElementById("cat").value;
    const isTrialUser = document.getElementById("Trial").checked;
    const notes = document.getElementById("notes").value;
    const issueType = document.getElementById("DevOrSupp").value;
    const isEscalated = document.getElementById("Escalated").checked;
    const isIssueChecked = document.querySelector('input[name="option"]:checked');
    const questionOrIssue = isIssueChecked ? "issue" : "question";
    const selectedPlatform = platformSelect.value;
    let ticketId = document.getElementById("current-url").value;

    console.log("Form values:", {
      ticketId,
      userId,
      category,
      notes,
      questionOrIssue,
      selectedPlatform
    });

    // All fields including notes are required as notes describe the issue
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
    setSubmitting(true);

    chrome.storage.local.get(["itURL", "itAPI", "username"], async ({ itURL, itAPI, username }) => {
      console.log("Got storage values:", { itURL, itAPI, username });
      errorMessage.textContent = ""; // Clear any previous error message
      successMessage.textContent = "";
      let platformLink;
      let platform;

      async function sendTicket() {
        console.log("Sending ticket with platform:", platform);
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

        console.log("Sending data:", data);
        console.log("API URL:", `${itURL}/issue?key=${itAPI}`);

        try {
          const response = await fetch(`${itURL}/issue?key=${itAPI}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
          });
          console.log("Raw response:", response);

          const responseText = await response.text();
          console.log("Response text:", responseText);

          if (response.ok) {
            let responseData;
            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              console.log("Response was not JSON:", responseText);
              responseData = responseText;
            }
            console.log("Success response data:", responseData);
            successMessage.classList.remove("hidden");
            successMessage.textContent = `Success! C: ${response.status}`;
            if (platform !== "Slack") {
              await sendInternalNote(data.platform, data.agentName, ticketId, data.uid, data.module, data.note, isEscalated);
            }
          } else {
            console.error("API request failed:", {
              status: response.status,
              statusText: response.statusText,
              response: responseText
            });
            errorMessage.classList.remove("hidden");
            errorMessage.textContent = `Error! C: ${response.status} - ${responseText}`;
          }
        } catch (error) {
          console.error("Error sending ticket:", {
            error: error,
            message: error.message,
            stack: error.stack
          });
          errorMessage.classList.remove("hidden");
          errorMessage.textContent = `Error: ${error.message}`;
        } finally {
          setSubmitting(false);
        }
      }

      if (selectedPlatform === "slack") {
        console.log("Selected Slack platform");
        platformLink = "slack";
        platform = "Slack";
        // For Slack, we keep the original URL as is
        await sendTicket();
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
          const currentUrl = tabs[0].url;
          console.log("Current URL:", currentUrl);
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
          await sendTicket();
        });
      }
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
        console.log(apiKey)
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
