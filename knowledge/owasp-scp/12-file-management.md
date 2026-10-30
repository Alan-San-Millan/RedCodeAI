---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "file-management"
languages: ["all"]
cwe: []
---

# File Management

- [180] Do not pass user supplied data directly to any dynamic include function
- [181] Require authentication before allowing a file to be uploaded
- [182] Limit the type of files that can be uploaded to only those types that are needed for business purposes
- [183] Validate uploaded files are the expected type by checking file headers. Checking for file type by extension alone is not sufficient
- [184] Do not save files in the same web context as the application. Files should either go to the content server or in the database.
- [185] Prevent or restrict the uploading of any file that may be interpreted by the web server.
- [186] Turn off execution privileges on file upload directories
- [187] Implement safe uploading in UNIX by mounting the targeted file directory as a logical drive using the associated path or the chrooted environment
- [188] When referencing existing files, use a white list of allowed file names and types. Validate the value of the parameter being passed and if it does not match one of the expected values, either reject it or use a hard coded default file value for the content instead
- [189] Do not pass user supplied data into a dynamic redirect. If this must be allowed, then the redirect should accept only validated, relative path URLs
- [190] Do not pass directory or file paths, use index values mapped to pre-defined list of paths
- [191] Never send the absolute file path to the client
- [192] Ensure application files and resources are read-only
- [193] Scan user uploaded files for viruses and malware
