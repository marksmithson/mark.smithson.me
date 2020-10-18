---
date: "2020-10-18"
title: "Walking Skeleton"
category: "Development"
---

It is common in software projects to encounter delays when you are trying to deploy the software or to get the system into production. Developers who have been working on the system struggle to understand the issues when the software "works fine on their machine". When you have a complete complex system it can be difficult to diagnose unexpected behaviour when deployed to a production environment. 

Creating a "Walking Skeleton" early in a project is a way to avoid this. A skeleton is a minimal system which does not have any valuable functionality but exercises the key components of the system being created - for example show some data from a database as text on a web page. To make the skeleton walk, we need to get in running in production, a process that will uncover a range of tasks that need to be completed. Examples include:
 - creating databases in production
 - identifying or provisioning infrastructure
 - getting sign off from compliance or security groups
 - creating deployment scripts
 - adding jobs to build servers
 - finding out who can make DNS changes

 Discovering these early allows them to be addressed appropriately, rather than resorting to the all to common shortcuts that take place when they are discovered at the end of a project and pressure to Go Live is strong. Long term this avoids creating technical debt.

 Having a Walking Skeleton at the start of a project gives the team confidence. They know that they can release to production and that they have a strong structure on which to flesh out the functionality required.

 A similar approach can be taken where a system is being expanded to adopt new technologies or interact with other systems. A skeleton implementation which exercises the technology or interacts with the other system can be created and made to walk by deploying to production. This has helped me identify issues with network security controls in production and differences in the way external systems behave in production to staging environments.