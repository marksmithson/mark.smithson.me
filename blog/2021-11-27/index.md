---
date: "2021-11-27"
title: "Updates across multiple GitHub repositories"
category: "Development"
---

You have adopted a microservices architecture and now have a number of services in different repositories. Perhaps you have created a template repository for these services and used this for all the different services.

You decide that you want to apply something across all the repositories - perhaps you want to adjust a GitHub workflow or setup [Dependabot](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically/about-dependabot-version-updates). Now it looks like you will need to checkout all the repositories and make similar changes to all of them. What a pain!

The [Multi-gitter](https://github.com/lindell/multi-gitter) tool can make this easier.

Multi-gitter makes it easy to modify multiple repositories by performing the following steps.
 - Use the GitHub API to get a list of repositories
 - Checkout each repository to a temporary location
 - Run a script against the source in that temporary location
 - Push any changes made by that script to a new branch and create a Pull Request for the changes

## Setting up Dependabot
Lets take a look at using it to setup Dependabot. To do this we need to create a `dependabot.yml` configuration file in the `.github` folder of the repository.

Multi-gitter can be installed from Homebrew using the following:

```
brew install lindell/multi-gitter/multi-gitter
```

We run multi-gitter using a command like the following:

```
multi-gitter run <command> -O <github-org> -m <commit-msg> -B <branch-name>
```

The supplied `command` is executed in the shell. As we will be using node for our script, our command will be `"node ${PWD}/add-dependabot.js"`.

In the example I have specified a GitHub Organisation to select the repositories to list. Alternatively you can specify a list of repositories or a GitHub user.

Multi-gitter needs to be able to access the GitHub API, so needs a `GITHUB_TOKEN` to be set in the shell.

Our repositories may have more than one `package-lock.json` so we will need to build the `dependabot.yml` programmatically to include these. We will use the `yaml` package to write the file. Make sure you have setup npm using `npm init` and then add the package using `npm i yaml`.

We can now write the `add-dependabot.js` script:

```js
const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

const findPackageFolders = (startPath, currentPath) => {
  currentPath = currentPath || startPath;
  const files = fs.readdirSync(currentPath);
  const result = [];
  files.forEach(file => {
    if (file === "package-lock.json") {
      result.push(currentPath.substring(startPath.length));
    }
    else if (file !== "node_modules") {
      const filename = path.join(currentPath, file);
      const stat = fs.lstatSync(filename);
      if (stat.isDirectory()){
        result.push(...findPackageFolders(startPath, filename));
      }
    }
  });
  return result.sort((a,b) => { return a.split("/").length - b.split("/").length; } );
};

const packageUpdates = (path) => {
  return {
    "package-ecosystem": "npm",
    directory: path || "/",
    schedule: {
      interval: "daily"
    }
  }
};

const packages = findPackageFolders(process.cwd());

if (packages.length > 0) {
  const updates = packages.map(package => packageUpdates(package));

  const dependabot = {
    version: 2,
    updates
  }
  const dependabotContent = yaml.stringify(dependabot);
  fs.mkdirSync(".github");
  fs.writeFileSync(".github/dependabot.yml", dependabotContent);
}
```

We can run this with a command like:
```bash
multi-gitter run "node ${PWD}/add-dependabot.js" -O marksmithson-test-org -m "Add Dependabot" -B add-dependabot
```

Looking at GitHub Pull Requests we can see that 3 Pull Requests have been created for our repositories:

![GitHub Pull Requests screenshot](/images/2021-11-27/pull-requests.png)

We can see that these pull requests add the `dependabot.yml` file.

![GitHub Add Dependabot Pull Request screenshot](/images/2021-11-27/pull-request.png)

We could merge these Pull Requests manually, however multi-gitter can also handle this for us using this command:

```bash
multi-gitter merge -O marksmithson-test-org -B add-dependabot
```

This merges the Pull Requests and merged and shortly afterwards we see Dependabot pull requests being created for our out of date dependencies.

![Dependabot Pull Request screenshot](/images/2021-11-27/dependabot-pr.png)

## Notes
### Deleting Files
If your script deletes files, you may notice that Multi-gitter is creating empty pull requests. This is due to Multi-gitter detecting a change has been made, but not issuing a `git delete` for the deleted files.

We can work around this, by issuing the `git delete` ourselves. We can use this git-client package for this - `npm i git-client`

This is used as shown below:

```js
const git = require('git-client');

const processRepository = async () => {
  //...  other code
  await git("rm", filePath);
  //...  other code
};

processRepository();
```

As the git function is async, we need to await it and wrap the script in an async function.

### References

- [Dependabot](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically/about-dependabot-version-updates)
- [Multi-gitter](https://github.com/lindell/multi-gitter)
- https://github.com/marksmithson-test-org/bulk-git