---
date: "2023-08-11"
title: "Handling undefined in Typescript"
category: "Development"
---

Today I learned a neat way of handling `undefined` in Typescript.

Suppose you have retrieved some data from an API which has optional fields. The Typescript model may look like this:

```typescript
interface Person {
    firstName: string
    middleName?: string
    surname: string
}
```

The type of `middleName` will be `string | undefined`.

If we want a function that uppercases the fields we could write it like this.

```typescript
const uppercase = (field: string | undefined) => {
   return field ? field.toUpperCase() : "";
};
```

A nicer alternative is this:

```typescript
const uppercase = (field = "") => {
   return field.toUpperCase();
};
```

If field is `undefined`, the default value will be assigned to the argument, removing the need for the check.
