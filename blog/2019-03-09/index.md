---
date: "2019-03-09"
title: "Paired Security Groups in AWS"
category: "Cloud"
---

Security Groups are virtual firewalls for instances and other resources in AWS. They allow you to define sets of rules for incoming and outgoing traffic. EC2 instances can have multiple security groups applied. The rules can identify the source or destination of the traffic using CIDR notation or by referring to other security groups.

As an example lets consider a Logstash cluster (https://www.elastic.co/products/logstash) where we want to allow applications to push logs to the cluster on port (5000). We also need to allow logstash to access the datastore for the logs (elasticsearch in this example).

![Diagram showing Application, Logstash and Elastic Search](/images/2019-03-09/basic.png)

Let's assume each part of this system has it’s own security group, so we have groups for _application_, _logstash_ and _elasticsearch_. When security groups are created in AWS, by default they allow all outgoing traffic, so let's stick with that for now and ignore the outgoing rules.

The *application *security group will allow traffic from everywhere on port 443 so that people can access the application from the internet using https.

![application security group rules screenshot](/images/2019-03-09/application-sg.png)

The _logstash_ security group allows access to port 5000 from the application security group so that the application can push logs to the collector.

![logstash security group rules screenshot](/images/2019-03-09/logstash-sg-basic.png)

The _elasticsearch_ security group allows access to port 9200 from the logstash security group so that logstash can push log documents to it.

![elasticsearch security group rules screenshot](/images/2019-03-09/elastic-sg.png)

This is great, everything works fine and our application becomes a great success. We now decide that we need to move to microservices so that we can scale the development team and scale parts of our application independently. We now have a system which looks like this:

![diagram showing web-server, application-service, user-service, search-service, favourites-service, logstash-cluster, elastic-search showing flow of logs to logstash cluster](/images/2019-03-09/microservices.png)

Each of these services has it’s own security group, allowing us to control access to the databases or other resources each service needs to access.

We now have more security groups we need to deal with. To allow access to the logstash cluster, we need to add rules for the security group of each new service pushing logs. This results in this:

![logstash security group rules screenshot](/images/2019-03-09/logstash-sg-microservices.png)

Our application continues to succeed and grow and our development team expands and enthusiastically adopts microservices. Pretty soon we have hundreds of microservices needing to access the logging cluster.

A simple way of doing this is to simply allow access from the subnets in which the services run:

![logstash security group rules screenshot](/images/2019-03-09/logstash-sg-subnet.png)

This gives us more flexibility, but we have lost information on what should be accessing the cluster and we may well be allowing access from parts of the system which do not need this access.

An alternative approach I have found useful in this type of situation is to use 2 security groups as a pair. To use this we create a _logsender_ Security Group and apply this to all instances which need to send logs to the logstash cluster.

![screenshot of instance with 2 security groups](/images/2019-03-09/instance-sgs.png)

We can now update the _logstash_ security group to allow access from the _logsender_ security group.

![logstash security group rules screenshot](/images/2019-03-09/logstash-sg-paired.png)

Now when we add a new service which requires access to the logstash cluster it is simply a matter of adding the _logsender_ security group to the instance running the service and not maintain a long list of rules in the _logstash_ security group.

If we want to lock down our security groups further and require outbound rules for services, it is now easy to ensure that services that need to send logs can access the logstash cluster by adding an outbound rule to the _logsender_ security group, rather than each of the service security groups.

![logsender security group outbound rules screenshot](/images/2019-03-09/logsender-sg.png)

It is now easy to add or remove services and it removes the risk of forgetting to remove redundant rules. Listing the instances which have the _logsender_ security group makes it easy to see which services have access to the logstash cluster.

```
aws ec2 describe-instances --filters Name=instance.group-name,Values="Log Sender" --output text --query 'Reservations[*].Instances[*].InstanceId'
```

Will return a list of matching instance-ids

### Limitations

AWS has a limit of 6 security groups per network interface which is normally sufficient, but should be considering when thinking about where to use this pattern (this can be increased to 16 by contacting support - https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html#vpc-limits-security-groups). I have found it most effective when dealing with services, such as logging, which will be accessed by a number of different clients. Using this pattern to setup security groups to allow a micro service to access its own dedicated database is probably overkill.

### Code

I used Terraform to create the security groups and rules used in thie article. This can be found here https://github.com/marksmithson/aws-paired-security-groups
