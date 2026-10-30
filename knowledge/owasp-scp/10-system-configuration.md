---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "system-configuration"
languages: ["all"]
cwe: []
---

# System Configuration

- [151] Ensure servers, frameworks and system components are running the latest approved version
- [152] Ensure servers, frameworks and system components have all patches issued for the version in use
- [153] Turn off directory listings
- [154] Restrict the web server, process and service accounts to the least privileges possible
- [155] When exceptions occur, fail securely
- [156] Remove all unnecessary functionality and files
- [157] Remove test code or any functionality not intended for production, prior to deployment
- [158] Prevent disclosure of your directory structure in the robots.txt file by placing directories not intended for public indexing into an isolated parent directory. Then "Disallow" that entire parent directory in the robots.txt file rather than Disallowing each individual directory
- [159] Define which HTTP methods, Get or Post, the application will support and whether it will be handled differently in different pages in the application
- [160] Disable unnecessary HTTP methods, such as WebDAV extensions. If an extended HTTP method that supports file handling is required, utilize a well-vetted authentication mechanism
- [161] If the web server handles both HTTP 1.0 and 1.1, ensure that both are configured in a similar manor or insure that you understand any difference that may exist (e.g. handling of extended HTTP methods)
- [162] Remove unnecessary information from HTTP response headers related to the OS, web-server version and application frameworks
- [163] The security configuration store for the application should be able to be output in human readable form to support auditing
- [164] Implement an asset management system and register system components and software in it
- [165] Isolate development environments from the production network and provide access only to authorized development and test groups. Development environments are often configured less securely than production environments and attackers may use this difference to discover shared weaknesses or as an avenue for exploitation
- [166] Implement a software change control system to manage and record changes to the code both in development and production
