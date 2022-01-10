---
date: "2022-01-10"
title: "Building and Deploying Software"
category: "Development"
---

A PagerDuty notification has just woken you up, there is a problem with your production site. You check the site and logs and everything seems OK at the moment, so you close the alert and try and get back to sleep.

Later on, at a more reasonable hour in the office (or the corner of your bedroom that is your office at the moment) you go back and look at the alert again. You see a spike in CPU usage around the time of the incident and note that there seems to have been a lot of activity on one of the URLs, but there are no errors in the logs to suggest that there is an issue. You add some additional logging to the endpoint to try and work out what is going on and review the test suite for the endpoint, it looks pretty comprehensive. All the tests are green and the endpoint works fine on staging. Chalking it up to a random event, you move on to other work.

PagerDuty wakes you up again the following night with a very similar alert. You realise how you hate week long on call rotations and make a mental note to raise this at the next team retro. Again you try and get back to sleep but the issue is preying on your mind. You resolve to get to the bottom of it the next day.

You embark on this mission by creating a performance test for this endpoint. After notifying the team you run this against your staging environment and it passes without any errors. Thinking it may be the sequence of events on production, you obtain a copy of the production endpoint logs and use this to create a test that simulates the production traffic as closely as possible, still no errors.

Confused you seek help from your colleagues. You pair with one of them, going through the code and trying out different ideas, with no success. In desperation you run the tests against production, and sure enough the test fails. 

WTF! how can this be, there must be something different about production. You get in touch with your Infrastructure Engineers to find out what they have changed in production (and forgot to apply to staging). Nothing has changed in the production infrastructure for months and they ALWAYS apply any changes to staging first, the issue must be due to the software that was deployed.

Oops you think, have I been really stupid (it would not be the first time) and not based my investigations off the production branch of the code. Phew, not this time and there have been no changes to the branch since the last deployment. So the software running in production should be the same, shouldn't it? To make sure you download the software from the production server and manually deploy this to staging. Sure enough the tests now fail. Progress at last.

Did the last deployment fail? No the version numbers are correct. You do a diff on the software deployed and a fresh build from the production branch and one of the dependencies is different. Eventually you work out that since the last deployment, the dependency management software on the build server has been updated. Relieved you have found the issue you do a new deployment to production and confirm that your tests pass on production.

Wow that was a lot of work, is there a way we could have arranged things to prevent these types of errors happening at all?

## Versioned, Immutable Software Artifacts

In the example above the deployment process pulls the source code from a git branch, builds it and then copies the built software to the server. This approach is very common, particularly with interpreted languages such as JavaScript, Python or PHP where the build process is very lightweight and in many cases, the source code is the deployed software. It is also appealing as the initial Developer Experience can be great - just run this one command to deploy.

The pitfalls to this approach stem from the difficulty in consistently reproducing builds of the software, particularly if we need to revert to a previous version. Poorly pinned dependencies, updates to build tools or the OS of the build server may all affect the result of a build process.

An alternative is to have our build server create a Versioned Immutable Software Artifact. This artifact can stored in a registry and used to deploy the software to different environments. Deployments to different environments can use different configurations for the software as described in [12 Factor Apps](https://12factor.net/config)

These software artifacts may be executables (.exe, .so), deployment packages(jar, deb, rpm), archive files (zip, tar) or containers (docker)

With this artifact used for deployments we have confidence that the code running in an environment is the same as the that running in a different environment with the same version. We can be assured that testing conducted in pre-production environments are against the same software we are deploying. Rollbacks also become easy, we just deploy the previous version of the software artifact - no need to mess around with git branches.

I prefer to use this approach with a single `main` branch. The build server adds a version tag to the repository identifying the source used for a particular version. I also often include a `git.ver` file in the software artifact containing the commit sha.

Another benefit of this approach is the decoupling of the build and deployment processes. The deployment process is simplified as there is no need to build the software. When deploying to sensitive environments such as production, this reduces the tools required as well as limiting the need to access third party resources, reducing the attack surface and improving the security of the process.

There is a cost in having a repository of artifacts and a more complex CI/CD pipeline. I have found this cost is normally worth paying for the increased confidence in reasoning about the system and the time this saves over the long term. 

Of course, it depends, and sometimes a great Dev Ex trumps this, particular for smaller projects and/or small teams.

### Appendix - Static Site Generators and Headless Content Management Systems

Recently I have been working on sites that use the [Prismic](https://prismic.io/) Headless CMS, with [Next.js](https://nextjs.org/) to statically generate the website. For these sites there are 2 build steps, building the core of the site and generating the static content based on the contents of the CMS.

I viewed this as the primary software being an application which can generate a static site based on content in the CMS. The build for this primary artifact created a versioned docker container which can be run to generate the site.

When content was update a different build process could use this container to generate the updated static site and deploy this to the production environment. It would have been possible to capture the updated static site as an artifact, which may well be desirable for some regulated industries as this would preserve a history for the published site.
