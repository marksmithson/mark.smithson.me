---
date: "2019-03-10"
title: "Using Branching with Terraform"
category: "Cloud"
---

When writing the code for my article on [Paired Security Groups in AWS](/paired-security-groups-in-aws), I made use of terraform to setup the various different configuration I wanted to demonstrate. This triggered some thoughts about how this could be applied more widely

## Managing Environment Variations
Perhaps somewhat obvious, but it seemed that there is some mileage in using this strategy when managing environments. For example, this could make it easy to quickly reconfigure the infrastructure for test environments - simplifying testing applications with slightly different infrastructure.

## Infrastructure Pull Requests
It should be possible to submit pull requests and automatically test that the changes to terraform work as expected. The steps may be something like this:
- Run `terraform apply` in a clean environment for the current state of the branch we are trying to merge into.
- Using the state that generated, run `terraform plan` to get the propsed changes - perhaps storing this as a check against the PR in github.
- Run `terraform apply` to verify that there are not any other errors
- Perhaps run a test suite to verify the changes have been made and that the environment is still 'healthy'. i.e. there are not regressions.
- Run `terraform destroy`. Both to clean up the infrastructure, but also to pick up andy issues the changes may introduce with being able to clean up easily.

