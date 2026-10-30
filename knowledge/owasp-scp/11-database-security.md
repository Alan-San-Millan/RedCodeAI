---
source: "OWASP Secure Coding Practices - Quick Reference Guide"
version: "2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)"
url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/"
license: "CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation"
retrieved_at: "2026-10-30"
category: "database-security"
languages: ["all"]
cwe: []
---

# Database Security

- [167] Use strongly typed parameterized queries
- [168] Utilize input validation and output encoding and be sure to address meta characters. If these fail, do not run the database command
- [169] Ensure that variables are strongly typed
- [170] The application should use the lowest possible level of privilege when accessing the database
- [171] Use secure credentials for database access
- [172] Connection strings should not be hard coded within the application. Connection strings should be stored in a separate configuration file on a trusted system and they should be encrypted.
- [173] Use stored procedures to abstract data access and allow for the removal of permissions to the base tables in the database
- [174] Close the connection as soon as possible
- [175] Remove or change all default database administrative passwords. Utilize strong passwords/phrases or implement multi-factor authentication
- [176] Turn off all unnecessary database functionality (e.g., unnecessary stored procedures or services, utility packages, install only the minimum set of features and options required (surface area reduction))
- [177] Remove unnecessary default vendor content (e.g., sample schemas)
- [178] Disable any default accounts that are not required to support business requirements
- [179] The application should connect to the database with different credentials for every trust distinction (e.g., user, read-only user, guest, administrators)
