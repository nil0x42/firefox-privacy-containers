browser.tabs.create({
  url: browser.runtime.getURL("tests/firefox/runner.html"),
}).catch(console.error);
