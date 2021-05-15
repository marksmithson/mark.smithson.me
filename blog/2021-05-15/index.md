---
date: "2021-05-15"
title: "Service Entity Identifiers"
category: "Development"
---

In a service oriented architecture, different parts of the system domain are managed by different services. A Order Service may manage orders and order items, whilst a Customer Service manages information about customers. To indicate that an order is for a particular customer the Order Service would store an identifier for the customer with orders for that customer.

I refer to an identitifer for an entity in a service, such as a customer as a "Service Entity Identifer". This could be anything that uniquely identifies the entity such the database primary key, a string or a random string. What makes a good identifier for an entity? Of course, it depends - however there are some characteristics which I have found useful.

#### Universal Uniqueness

If the identifier is unique across all services in a system, (or even across all systems) it is impossible to accidently use the wrong identifier with the wrong service.

#### Distributed Generation

Identifiers which can be generated independently, without reliance on a central authority make it easier to provide replication, offline support, synchronisation and horizontal scaling.

#### Service Identification

Embedding the service name in the identifier makes it self describing. This simplifies joining data across sercices in data warehouses for analysis. With this characteristic we can eaily handle scenarios where we want to reference an entity which could be managed by different services. For example, an order which may relate to a corporate customer or a retail customer which are managed by different services. We can store the identifer in the same order field an will know which service to contact to retrieve the customer information as this is part of the identifier.

#### Sortable

Sorting using a non key column in NoSQL databases can be expensive, although many of these databases do sort entities based on their primary key. Having an identifier which encodes a timestamp gives us sorting of records by timestamp for free. This characteristic is not be desirable in situations we do not want to allow consumers to see a timestamp. If entity identifiers are public, using an identifier which encodes a timestamp would expose this information and should be avoided.

### Implementations

There are existing technologies and techniques, which can be used to provide some or all of these characteristics.

#### UUID

A UUID is a Universal Unique Identifier which is unique across all identifiers that are generated. Strictly speaking there is a very small probability that the same identifer could be generated more than once, but this can be ignored for most use cases.

Some versions of UUIDs achieve this by encoding data such as the network MAC address and should normally be avoided due to privacy concerns. v4 UUIDs are generated using a random number generator and allow identifiers to be created without a central authority.

UUIDs are 128 bits, and are usually encoded in a hex format - for example `d87c43ef-e2a0-42f9-9948-ae81a7cdbcd4`. Libraries to generate and handle UUIDs are widely available.

As UUIDs are random by design, they are not sortable and do not encode any service information.

#### ULID

A ULID is a Universally Unique Lexicographically Sortable Identifier and is similar to UUIDs in that it is also 128 bits. ULIDs differ in that the first 48 bits are a timestamp with millisecond resolution, with the remaining 80 bits being random. ULIDs are encoded are 26 character strings using Crockford's base32 encoding. These identifier sort Lexicographically based on the timestamp component. An example of a ULID is `01ARZ3NDEKTSV4RRFFQ69G5FAV`

Although these identifiers have less randomness, the probability of the same identifier being generated is similar to UUIDs such that it can be ignored for most use cases.

#### URI
A URI is a Uniform Resource Identifier, which is a string with the following format:

`scheme:[//authority]path[?query][#fragment]`

URLs such as `https://mark.smithson.me/index.html` are a type of URI, as are mail links such as `mailto:mark@smithson.me`.

Combining a ULID with a URI, provies all the characteristics outlined above. 

For example `esi://customer/01ARZ3NDEKTSV4RRFFQ69G5FAV`. In this URI, the scheme `esi` represents an Entity Service Identifier and specifies the service name `customer` as the authority. The path `01ARZ3NDEKTSV4RRFFQ69G5FAV` is the ULID identifier of the entity within the service. With this URI and knowledge of the services in our system, we could retrieve information about the entity it identifies.

In larger systems a library or service can be created which knows how to resolve these URIs, perhaps making use of a registry of services.

A downside of this approach is that the identifiers are quite long, and will consume more storage space, and network bandwidth.

I have found that making the Entity Service Identifiers do more helps to make service oriented systems more understandable and flexible. It makes implementing distributed use cases easier and protects us against our own stupidity.

(Yes, I have spend far to long trying to find objects in the wrong service!)