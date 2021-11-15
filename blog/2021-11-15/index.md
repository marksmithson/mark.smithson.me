---
date: "2021-11-15"
title: "Pulumi Function Serialisation by Example"
category: "Development"
---

[Pulumi](https://www.pulumi.com) is an Infrastructure as Code tool, similar Terraform, except that instead of using a specialised language like hcl or yaml, you can use general purpose programming languages including Javascript, Typescript, Python and C#.

When deploying a lambda function you would typically build you function code, package it into a zip file, and reference that when creating the Lambda function. This is possible using pulumi as shown below:

```ts
export = async () => {
  const lambdaRole = new aws.iam.Role("lambdaRole", {
    assumeRolePolicy: assumeRolePolicyForPrincipal(Principals.LambdaPrincipal)
  });
  
  const lambdaZip = new aws.lambda.Function("lambdaZip", {
    code: new pulumi.asset.FileArchive("lambda/lambda.zip"),
    role: lambdaRole.arn,
    handler: "index.handler",
    runtime: Runtime.NodeJS14dX,
  });
};
```

If you are using Javascript/Typescript, Pulumi has a great feature where you can define Lambda functions as inline code. This avoids the need to manage your lambda function separately and is incredibly valuable when attaching lambda functions to events, such as `onObject` events for S3 Buckets.

```ts
export = async {
  const bucket = new aws.s3.Bucket("mybucket");
  bucket.onObjectCreated("onObject", async (event: aws.s3.BucketEvent) => {
    console.log(JSON.stringify(event));
  });
}
```

In this article we will do a deep dive into how this works with examples. This has helped me understand why things work the way they do and allows me to use this approach much more effectively.

> Out of the box, Pulumi targets the Node 12 runtime and ES2016. For this article I am targeting ES2020 and Node 14 as this simplifies the generated code. (Add `"target": "es2020"` to `tsconfig.json`)

## Simple Function

Lets start with a simple function and see what we get.

```ts
export = async {
  const lambda = new aws.lambda.CallbackFunction("lambda", {
    callback: (event) => {
      console.log("Hello from Pulumi");
    },
    runtime: Runtime.NodeJS14dX
  });
}
```

When this is executed by Pulumi, using `pulumi up`, the handler function is serialised and a lambda function created which will execute the handler when called.

This is the code Pulumi generates amd deploys for the function:

```javascript
exports.handler = __f0;

function __f0(__0) {
  return (function() {
    with({  }) {

      return (event) => {
         console.log("Hello from Pulumi");
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

The lambda handler is exported as `__f0`. This calls our callback function via a wrapper function using `apply`. In this case the wrapper function does nothing.

[`apply`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply) calls the function with a supplied `this` value and an array of arguments. 

This first apply call invokes the returned anonymous function unwrapping the target function which is then called with `this` and `arguments`.

We can see the purpose of the wrapper function if we make our function use a variable outside of the function scope.

```ts
export = async () => {
  const message = "Hello from Pulumi";
  const lambda = new aws.lambda.CallbackFunction("lambda", {
    callback: (event) => {
      console.log(message);
    },
    runtime: Runtime.NodeJS14dX
  });
}
```

We now get this code for the lambda:

```javascript
exports.handler = __f0;

function __f0(__0) {
  return (function() {
    with({ message: "Hello from Pulumi" }) {

      return (event) => {
        console.log(message);
      };
    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

Pulumi has captured the value of this variable and included it in the `with` statement of the wrapper function, making it available to our callback function.

> Pulumi uses the node v8 library to obtain the value of this variable when the pulumi program is run. (using `lookupCapturedVariableValueAsync`)

> [`with`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with) is not commonly used, it adds the expression to the scope chain. In this case it allows pulumi to use the names in the original code whilst ensuring that generated variable names can be unique.

## Calling other functions

If we call other functions from within our handler, they are captured in a similar way. For this example:

```ts
const log = (message: string) => {
  console.log(message);
}

export = async () => {
  const message = "Hello from Pulumi";
  const lambda = new aws.lambda.CallbackFunction("lambda", {
    callback: (event) => {
      log(message);
    },
    runtime: Runtime.NodeJS14dX
  });
}
```

The following lambda code is generated:

```javascript
exports.handler = __f0;

function __f1(__0) {
  return (function() {
    with({  }) {
      return (message) => {
          console.log(message);
      };
    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f0(__0) {
  return (function() {
    with({ log: __f1, message: "Hello from Pulumi" }) {

      return (event) => {
        log(message);
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

Here we can see that the log function has been output into the lambda function and also wrapper in a wrapper function `__f1`. The log function is then included in the with statement for our calllback `with({ log: __f1, ...})`.

If our log function refers to a variable outside of it's scope, this will be captured and included in it's wrapper function as shown below:

```ts
const suffix = " via Lambda";

const log = (message: string) => {
  console.log(`${message}${suffix}`);
}
```

The result is as expected with the `suffix` variable being captured in the with statement in `__f1`:

```javascript
exports.handler = __f0;

function __f1(__0) {
  return (function() {
    with({ suffix: " via Lambda" }) {

      return (message) => {
        console.log(`${message}${suffix}`);
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f0(__0) {
  return (function() {
    with({ log: __f1, message: "Hello from Pulumi" }) {

      return async (event) => {
        log(message);
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

## Changing captured values

So far we have been capturing the value of `const` variables which cannot change. What happens if are capturing a variable which may change in the Pulumi program?

```ts
let secondMessage = "Hello from Pulumi before the callback";

const mutatedLambda = new aws.lambda.CallbackFunction("mutatedVariableLambda", {
  callback: (event) => {
    console.log(secondMessage);
  },
  runtime: Runtime.NodeJS14dX
});

secondMessage = "Hello from Pulumi after the callback";
```

And the generated code is:

```js
exports.handler = __f0;

function __f0(__0) {
  return (function() {
    with({ secondMessage: "Hello from Pulumi after the callback" }) {

      return (event) => {
        console.log(secondMessage);
      };
    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

The value captured is the value set after the code to create the Lambda. This is different to the Pulumi documentation https://www.pulumi.com/docs/intro/concepts/function-serialization/#pulumi-execution-order - lets's investigate.

In the [constructor](https://github.com/pulumi/pulumi-aws/blob/69a7e8fcac8a3733275186e0a5c8dea927e9a4df/sdk/nodejs/lambda/lambdaMixins.ts#L329) for the `CallbackFunction` component, Pulumi calls `pulumi.runtime.serializeFunction`

This function is `async` but is not called with an `await`. This means that code execution will continue and the mutation of the variable can occur before the function is serialised.

We can confirm this by adding a sleep before we mutate the `secondMessage` variable. 

```ts
await new Promise(resolve => {
  setTimeout(resolve, 100);
});
```
When we do this, the captured value is the original `"Hello from Pulumi before the callback"`.

It can be difficult to determine what value will be captured when the state of the captured variable may change. Making sure that any state outside of the function scope is not mutated (using `const`) is therefore a great way to make your code more robust.

## Capturing Large Objects

Pulumi performs some optimisations of captured object values. Pulumi only serialises the properties which are actually used.

```ts
const data = { first: "value", second: "value", nested: { third: "value", fourth: "value" } };

const objectCaptureLambda = new aws.lambda.CallbackFunction("objectCaptureLambda", {
  callback: (event) => {
    console.log(`${data.first} - ${data.nested.third}`);
  },
  runtime: Runtime.NodeJS14dX
});
```

results in:

```js
exports.handler = __f0;

var __data = {};
__data.first = "value";
var __data_nested = {third: "value"};
__data.nested = __data_nested;

function __f0(__0) {
  return (function() {
    with({ data: __data }) {

      return (event) => {
          console.log(`${data.first} - ${data.nested.third}`);
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

We can see here that `data.second` and `data.nested.fourth` have not been captured.

Note that this does not happen if you are accessing an object in an array. All objects in an array are serialised with all their properties.

### Promises

If the variable to be captured is a promise, Pulumi awaits the promise and captures the result:

```ts
const promise = new Promise((resolve) => {
  resolve("hello promise");
});
const promiseLambda = new aws.lambda.CallbackFunction("promiseLambda", {
  callback: (event) => {
    console.log(promise);
  },
  runtime: Runtime.NodeJS14dX
});
```

results in:

```js
exports.handler = __f0;

function __f0(__0) {
  return (function() {
    with({ promise: "hello promise" }) {

return (event) => {
            console.log(promise);
        };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

This means that you do not need to await the variable from within the callback.

## Capturing Class Objects

If reference a class variable, the class is captured and serialised.

```ts
class Obj {
  message: string = "hello from class";
  public callback () {
    console.log(this.message);
  }
}

const obj = new Obj();

const lambdaWithObj = new aws.lambda.CallbackFunction("lambdaWithObj", {
  callback: () => {obj.callback()},
  runtime: Runtime.NodeJS14dX
});
```

Generates this code:

```js
exports.handler = __f0;

var __obj_proto = {};
Object.defineProperty(__f1, "prototype", { value: __obj_proto });
Object.defineProperty(__obj_proto, "constructor", { configurable: true, writable: true, value: __f1 });
Object.defineProperty(__obj_proto, "callback", { configurable: true, writable: true, value: __f2 });
var __obj = Object.create(__obj_proto);
__obj.message = "hello from class";

function __f1() {
  return (function() {
    with({  }) {

return function /*constructor*/() {
        this.message = "hello from class";
    };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f2() {
  return (function() {
    with({  }) {

return function /*callback*/() {
        console.log(this.message);
    };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f0() {
  return (function() {
    with({ obj: __obj }) {

return () => { obj.callback(); };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

A prototype has been created with the class functions and an object created from that class.

Note that if we set the callback function to a class method, only the method is serialised and not the class itself. This means that if the function refers to state of the object, this will not be available. Modifying the example above:

```ts
class Obj {
  message: string = "hello from class";
  public callback () {
    console.log(this.message);
  }
}

const obj = new Obj();

const lambdaWithObj = new aws.lambda.CallbackFunction("lambdaWithObj", {
  callback: obj.callback,
  runtime: Runtime.NodeJS14dX
});
```

results in:

```js
exports.handler = __f0;

function __f0() {
  return (function() {
    with({  }) {

return function /*callback*/() {
        console.log(this.message);
    };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```
We can see that Pulumi has not recognised that the function is part of a class object and has not serialised the class.

When this is invoked it logs `undefined` as pulumi has not captured the value of `this.message`.

We should therefore avoid referencing functions within objects directly, rather we should reference the object and call the function on that object from our callback.

## Referencing Pulumi Outputs

It is possible to reference the outputs of other pulumi components within the function. This can be useful to embed configuration within the code. 

```ts
const output = pulumi.output("an output value");
const outputLambda = new aws.lambda.CallbackFunction("outputLambda", {
  callback: (event) => {
    console.log(output.get());
  },
  runtime: Runtime.NodeJS14dX
});
```

generates this:

```js
exports.handler = __f0;

var __output_proto = {};
Object.defineProperty(__f1, "prototype", { value: __output_proto });
Object.defineProperty(__output_proto, "constructor", { configurable: true, writable: true, value: __f1 });
Object.defineProperty(__output_proto, "apply", { configurable: true, writable: true, value: __f2 });
Object.defineProperty(__output_proto, "get", { configurable: true, writable: true, value: __f3 });
var __output = Object.create(__output_proto);
__output.value = "an output value";

function __f1(__0) {
  return (function() {
    with({  }) {

return function /*constructor*/(value) {
        this.value = value;
    };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f2(__0) {
  return (function() {
    with({  }) {

return function /*apply*/(func) {
        throw new Error("'apply' is not allowed from inside a cloud-callback. Use 'get' to retrieve the value of this Output directly.");
    };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f3() {
  return (function() {
    with({  }) {

return function /*get*/() {
        return this.value;
    };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

function __f0(__0) {
  return (function() {
    with({ output: __output }) {

return (event) => {
            console.log(output.get());
        };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

The output object is captured and can get accessed using `get()`. If you try and use `apply` on the output within the lambda code, an error will be thrown.

> In most cases, I would provide this configuration as environment variables as this make these dependencies of the function more explicit. This approach may be useful for simple event handlers.

## Using Pulumi Secrets

If the code references a pulumi secret, the code produced is the same as for a pulumi output. However the state file created by pulumi encrypts the function contents, rather than storing it as plain text.

## Using Modules
If we have a module defined in the local project, for example in `module.ts`

```ts
export const moduleFunction = () => {
  console.log( "Hello from moduleFunction");
}

export const additional = () => {
  console.log("additional");
}
```

We can import that module and use it's exports in the lambda:

```ts
import { moduleFunction } from "./module";
const moduleFunctionLambda = new aws.lambda.CallbackFunction("moduleFunctionLambda", {
  callback: moduleFunction,
  runtime: Runtime.NodeJS14dX
});
```

this results in the following:

```js
exports.handler = __f0;

function __f0() {
  return (function() {
    with({  }) {

      return () => {
          console.log("Hello from moduleFunction");
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

The function we have referenced has been included as if it were in the current file. Additional exports from the module have not been included.

The situation is different if we install a package and reference that. Lets use lodash as an example.

```ts
import * as _ from "lodash";
const externalModuleFunctionLambda = new aws.lambda.CallbackFunction("externalModuleFunctionLambda", {
  callback: ()=>{
    console.log(_.camelCase("Hello from external module function"));
  },
  
  runtime: Runtime.NodeJS14dX
});
```

results in:

```js
exports.handler = __f0;

function __f0() {
  return (function() {
    with({ lodash_1: require("lodash/lodash.js") }) {

      return () => {
        console.log((0, lodash_1.camelCase)("Hello from external module function"));
      };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}
```

We can see that the lodash module is included with a `require`. The lodash package is included in the lambda function in a `node_modules` folder. The complete lodash package is included in the lambda function, not just the `camelCase` function.

In fact the package will be included even if your function does not reference a function in the package. Pulumi will include all runtime packages, irrespective of whether they are used in the function or not. The exceptions are nodejs built in modules, pulumi modules, modules that have `pulumi.runtimeDependencies` section in their `package.json`, or the `aws-sdk` (as this is always present in nodejs lambda functions).

> Note that the built in node modules are based on node 6. If you use more recent modules, you may experience issues. (such as `http2`). This list of recognised built in modules is here: https://github.com/pulumi/pulumi/blob/master/sdk/nodejs/runtime/closure/createClosure.ts#L1324

This is not ideal from the point of view of the code size for the lambda function. This can have an effect on deployment time (as more code needs to be updated) and the initial load time.

Pulumi provides a way to exclude external modules when declaring a lambda function via the `codePathOptions` argument.

```ts
codePathOptions:{
  extraExcludePackages: ["lodash"]
},
```

This will prevent the listed packages being included in the lambda function if we don't need it. Don't put packages you do need here, or they won't be included!

Pulumi does not perform tree shaking which has the potential to automatically exclude code which is not used. It is understandable that this approach was taken - it is a pragmatic decision to be able to deliver this functionality in a reasonable timescale. It can be beneficial to use smaller modules that only contain the functionality you require. In our example we could have used the `lodash.camelcase` package.

### ES6 Modules

Pulumi requires that packages we use are compatible with `commonjs`. This means we are not able to use packages which have been built as ES6 modules. If you try and do this you will get the error:

`Error [ERR_REQUIRE_ESM]: Must use import to load ES Module:`

When running the Pulumi program, the Javascript language host uses a `require` to load the program https://github.com/pulumi/pulumi/blob/master/sdk/nodejs/cmd/run/run.ts#L247. This means that the cjs loader is used which will not allow import statements in the code resulting in the error `SyntaxError: Cannot use import statement outside a module`. As we are not allowed to `require` an ES module, there is no way around this without changes to the Pulumi source code.

## Using a Callback Factory

When designing Lambda functions we often want to initialise a client once or retrieve some expensive state that we can use during future invocations.

Pulumi allows us to specify a callback factory function to achieve this as shown below:

```ts
const callBackFactory = new aws.lambda.CallbackFunction("callbackFactory", {
  callbackFactory: () => {
    const state = "some factory state";
    return () => {
      console.log("Hello from callbackFactory created callback with state: " + state);
    }
  },
  runtime: Runtime.NodeJS14dX
});
```

results in:

```js
function __f0() {
  return (function() {
    with({  }) {

return () => {
            const state = "some factory state";
            return () => {
                console.log("Hello from callbackFactory created callback with state: " + state);
            };
        };

    }
  }).apply(undefined, undefined).apply(this, arguments);
}

exports.handler = __f0();
```

Here we can see that `exports.handler` is set the result of the factory function.

As an example, this can be useful to initialise aws sdk clients.

## Recap

Pulumi function serialisation can be used to make Pulumi IaC programs easier to understand. I have found a few techniques help keep things working as you expect them to:

- don't use ES6 modules
- target ES2020 on Node 14 - this makes the generated code easier to understand and closer to what you have written
- only reference `const` variables from inside the callback
- make use of `extraExcludeDependencies` to limit the lambda function size
- use small external packages wherever possible
- make use of `callbackFactory` to initialise clients or other expensive state
- remember to use `get()` when referencing pulumi outputs from within a callback
- don't use class functions as callbacks

## References

### Articles
- https://www.pulumi.com/docs/intro/concepts/function-serialization/

### Documentation
- https://www.pulumi.com/registry/packages/aws/api-docs/lambda/function/

### Source Code
- https://github.com/pulumi/pulumi/tree/master/sdk/nodejs/runtime/closure
- https://github.com/pulumi/pulumi-aws/tree/master/sdk/nodejs/lambda


