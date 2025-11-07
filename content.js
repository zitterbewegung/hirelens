// Listen for a message from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_JOB_DESCRIPTION') {
    const jobText = getJobDescriptionText();
    if (jobText) {
      sendResponse({ success: true, text: jobText });
    } else {
      sendResponse({ success: false, error: "Could not find job description on this page." });
    }
  }
  // Return true to indicate you wish to send a response asynchronously
  return true; 
});

// Function to find and extract job description text from various job sites
function getJobDescriptionText() {
  // Add selectors for popular job boards. This list can be expanded.
  const selectors = [
    // LinkedIn
    '.jobs-description__content .jobs-description-content__text', 
    '#job-details',
    // Indeed
    '#jobDescriptionText',
    // Greenhouse
    '#content',
    // Lever
    '.content .section-wrapper .postings-body',
    // Generic
    'article',
    'main',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText.length > 200) { // Check for a reasonable length
      return element.innerText.trim();
    }
  }
  
  // Fallback to body if nothing else is found, but it might be messy.
  return document.body.innerText.trim();
}
