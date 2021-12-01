---
date: "2021-12-01"
title: "Invoking Scala Methods"
category: "Development"
---

I am learning Scala at the moment. One of the things that seemed strange is the ability to invoke methods in a number of different ways.

For example all the following are valid and equivalent:

```scala
obj.method(param)

obj method(param)

obj method param
```

Why does Scala support this? Yes I can see that in some situations being able to omit parts of the full method call may make the code read more naturally. However mixing of these styles may end up making the code harder to read. 🤔

This may be due to the fact that everything in Scala is an object, and that common operators are actually methods on these objects. For example the following are equivalent:

```scala

val x = 1 + 1

val x = (1).+(1)
```

It would certainly be weird writing that expression using the second syntax.

The [Scala Style Guide](https://docs.scala-lang.org/style/method-invocation.html) has some guidance on when to use the different syntaxes. TLDR; prefer the full form `obj.method(param)`


