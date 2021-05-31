---
date: "2021-05-31"
title: "12 Factor App Secrets Management"
category: "Development"
---

The [Twelve-Factor App](https://12factor.net/) describes a 12 principles for building Software-as-a-Service (SaaS) apps.

The Third Factor ["Config"](https://12factor.net/config) states that there must be strict _separation of config from code_. It suggests that that config should be stored in environment variables and that this config includes credentials or secrets.

This brings a number of benefits including:

- secrets are not stored in source code where they could be exposed
- secrets are not baked into deployment artifacts (such as docker images) where thay could also be exposed
- the same deployment artifact can be used in different environments with different credentials
- environment variables are well supported and are language and framework independent

## Protecting Secrets

Although secrets are a type a config, by their nature they are more sensitive and require careful management. Whilst not ideal, disclosure of a normal configuration item has less risk than disclosure of a secret configuration item.

Configuration items may be stored in deployment descriptors such as Kubernetes manifests, Docker Compose files or shell scripts, many of which may well be checked into source control. Indeed this is encouraged as part of GitOps management of environments.

Secrets should not be treated in the same way as other configuration items and additional protection is required.

### Storing & Rotating Secrets

We need to ensure that secrets storage is secure and that access to secrets is limited to the apps that needs them.

No system is ever 100% secure and it is possible that despite our best efforts secrets will be compromised. An effective mitgation against this is to regularly change or rotate the secrets.

When dealing with security code, we don't want to re-invent the wheel. It is much better to use solutions which have been battle tested at scale.

Fortunatley, cloud providers provide secure solutions for this including [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/), [GCP Secret Manager](https://cloud.google.com/secret-manager) and [Azure Key Vault](https://azure.microsoft.com/en-gb/services/key-vault/). [Hashicorp Vault](https://www.vaultproject.io/) is a widely supported cloud agnostic alternative.

### Accessing Secrets at Runtime

Asusming we make use of one of these solutions (and we should!), how do we gain access to the secrets at runtime.

#### Access the Secret Manager directly

It is possible to have the app to authorise with the Secrets Manager and call the API to obtain the secret. 

This works well and follows the 12 factor principle, particularly if the key for the secret in the secret manager is provided via an environment variables and has the advantage of limiting the number of moving parts.

It does makes the app more complex as it needs to include code to call the secrets manager API. It can also make running the app in development environments more complex and dependent on the Secrets Manager.

#### Have the runtime environment provide the secrets

The responsibility and complexity of obtaining secrets from the secret manager can be moved to the runtime environment. The secrets can be then be provided to apps by the runtime environment via environment variables or files.

This is my preferred approach whenever possible. It is a common requirement for different apps and this approach keeps the security sensitive code in a single place.

This can be difficult to achieve in some environments, such as AWS Lambda. In these situations a pragmatic choice may be to embed the Secret Manager code (although it may be possible to use Lambda Extensions or wrapper scripts). Providing a way to run the app without access to the Secret Manager makes development environments simpler and easier to setup.

### Environment Variables or Configuration Files

The Twelve Factor App advocates for configuration to be passed as environment variables, which has the benefits of simplicity and ubiquity. 

This can become unweildy which some types of secrets such as long cryptographic keys, particularly when trying to provide these manaually as part of the deployment process.

In some runtime environments, environment variables may be logged or reported when inspecting workloads and are available to child processes These may lead to increased risk of compromise of secrets. See this article for more info -
https://movingfast.io/articles/environment-variables-considered-harmful/.

When we rotate our secrets and are using environment variables, we need to restart the app for it to pick up these changes. If our app starts and shuts down quickly and we are running many copies this should not be problematic. If not, this can cause downtime or disruption.

An alternative is to provide the secrets via a configuration file in a volume accessible to the app. This makes it easier to handle larger secrets. The volume should be encrypted and may be implemented as an in-memory volume, such as dockers `tmpfs`. 

The app can monitor the configuration file for changes and reload it's configuration, or could be signalled when a configuration change is made.

The approach you use will depend on your runtime environment and application requirements. It may be complex to attach secure temporary volumes, or perhaps there is no issue with restarting you app.