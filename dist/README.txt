This folder contains the packaged idt-agent and supporting files.

Files included:
- idt-agent.exe       : Packaged agent executable (Windows)
- chromedriver.exe    : Chromedriver binary used by the agent to drive Chrome
- node_modules/...     : Minimal runtime modules (selenium-webdriver, chromedriver)
- runner-core-selenium.js : The Selenium runner script used by the agent

How to run:
1. Ensure Chrome is installed and chromedriver.exe matches Chrome's version.
2. Run the agent in a shell:
   .\idt-agent.exe
3. Test the agent from another shell:
   curl http://127.0.0.1:4599/test

Troubleshooting:
- If /test returns an error about chromedriver or driver creation, check chromedriver version.
- If the exe cannot find runner-core-selenium, ensure the dist/ directory contains runner-core-selenium.js and node_modules/selenium-webdriver.
- On Windows, right-click the chromedriver.exe file, Properties -> Unblock if Windows blocks execution.

This README was generated automatically by the build pipeline.
