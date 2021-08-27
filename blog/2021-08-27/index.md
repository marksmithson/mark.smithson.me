---
date: "2021-08-27"
title: "Jest Mocking Patterns"
category: "Development"
---

Getting your head around using Jest to mock dependencies, particularly with Typescript can be difficult. The documentation focusses on features, making it challenging to work out how to make use of Jest mocks. 

This post describes how I use Jest with Typescript. I hope someone finds it useful - I am pretty sure my future self will!

## Setup
First of all setup, you will need jest as a dev dependency in your project (obviosuly), as well as `ts-jest` to make it easier to use with Typescript.

`devDependencies` in package.json should look like this:

```JSON
"devDependencies": {
  "@tsconfig/node14": "^1.0.1",
  "@types/jest": "^26.0.24",
  "@types/node": "^16.6.1",
  "jest": "^27.0.6",
  "ts-jest": "^27.0.4",
  "typescript": "^4.3.5"
}
```


Jest can be configured in package json like this:

```JSON
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node"
}
```

## Mocking a module function

Suppose we have a simple function in a module we want to test, such as:

```typescript
import fs from "fs";

export const readJsonFile = (fileName:string) => {
  try {
    const data = fs.readFileSync(fileName);
    return JSON.parse(data.toString());
  }
  catch (error) {
    // handle file not found
    if (error.code === "ENOENT") {
      return undefined;
    }
    // handle invalid json
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
}
```

This function takes a fileName and returns the contents of that file as parsed JSON. It has error handling for the file not being found and the file not conatining valid JSON.

How do we write a test for this function? 

A simple way of doing this is to have test files in your project which you can attempt to load and verify the behaviour of the function. However this means that our test is exercising the file system which will slow down test execution and have an effect on our feedback loop. 

In this example the impact is very small, however we may be using a module which calls a database, or performs an expensive operation. It is easy to get into a situation where tests take a long time to run and we are using elaborate setup and tear down logic to ensure we have consistent data for tests.

We can isolate our tests from external systems using mocks. Jest provides the ability to create mocks dynamically and control their behaviour. This is how we can use Jest to test this function:

```ts
import { readJsonFile } from ".";
import { readFileSync } from "fs";
import { mocked } from "ts-jest/utils";

jest.mock("fs");

const readFileSyncMock = mocked(readFileSync);

describe("Read JSON File", () => {
  test("loads file and returns parsed JSON", () => {
    // given
    const buffer = Buffer.from(JSON.stringify({ ok: true }));
    readFileSyncMock.mockReturnValue(buffer);

    // when
    const result = readJsonFile("file.test")

    // then 
    expect(result.ok).toBe(true);
    expect(readFileSyncMock).toBeCalledWith("file.test");
  });
});
```


We import the function we want to mock into our test file and then call `jest.mock("fs")`:
```ts
import { readFileSync } from "fs";

jest.mock("fs");
```

In Javascript we would now be able to call mock functions on the `readFileSync` variable, however Typescript is not aware of these functions and will generate errors if we try and use them. We can use the `mocked` helper in `ts-jest` to solve this:
```ts
import { mocked } from "ts-jest/utils";

const readFileSyncMock = mocked(readFileSync);
```

We now have access to the Jest mock functions via the `readFileSyncMock` constant, along with Intellisense in your IDE.

Aside: The `mocked` function is an interesting use of Typescript, well worth a look if you want to test your knowledge of Typescript. https://github.com/kulshekhar/ts-jest/blob/master/src/utils/testing.ts


We mock the return value for `readFileSync` using:
```ts
readFileSyncMock.mockReturnValue(buffer);
```

and verify it was called with the argument using:
```ts
expect(readFileSyncMock).toBeCalledWith("file.test");
```

We can also use the mock to test the error handling:
```ts
test("when file does not exists returns undefined", () => {
    // given
    readFileSyncMock.mockImplementation(() => { throw { code:"ENOENT" } });

    // when
    const result = readJsonFile("file.test")

    // then 
    expect(result).toBeUndefined();
  });

  test("when file not JSON returns undefined", () => {
    // given
    const buffer = Buffer.from("notjson");
    readFileSyncMock.mockReturnValue(buffer);

    // when
    const result = readJsonFile("file.test")

    // then 
    expect(result).toBeUndefined();
  });
  ```

Here we use `mockImplementation` to throw an error when `readFileSync` is called, replicating the functionality of the real function in this scenario:

```ts
readFileSyncMock.mockImplementation(() => { 
  throw { code:"ENOENT" };
});
```

When using mocks it is good practice to reset them between tests to avoid polluting the results, we can do this with a `beforeEach` function:

```ts
beforeEach( () => {
  readFileSyncMock.mockReset();
});
```

or

```ts
beforeEach( () => {
  jest.resetAllMocks();
});
```

Note that `mockReset()` clears any mock implementations or return values as well as information on when the mock was called. If we want to retain the implementation / return value we can use `mockClear()` instead.

This pattern can be used if you need to mock a single function, mutliple functions from the same module or even functions from different modules.

Mocking a class is slightly different.

## Mock a class

We will use the AWS SDK to download a file from S3 as an example. The code we would use to do this involves creating an instance of the S3 class:

```ts
export const readFromS3 = async (bucket: string, key:string) => {
  const s3 = new AWS.S3();
  try {
    const object = await s3.getObject({ Bucket: bucket, Key: key}).promise();
    return JSON.parse(object.Body?.toString()!);
  }
  catch (error){
    if (error.code == "NoSuchKey"){
      return undefined;
    }
    throw error;
  }
};
```

A test for this function would look like:

```ts
import { mocked } from 'ts-jest/utils';
import { readFromS3 } from "./s3";
import { S3 } from 'aws-sdk';

const S3Mock = mocked(S3);
const mockGetObjectPromise = jest.fn();
const mockGetObject = jest.fn(() => ({ promise: mockGetObjectPromise }));
S3Mock.mockImplementation(() => ({ getObject: mockGetObject } as any));

jest.mock('aws-sdk');

describe("readFromS3 tests", () => {
 test("get object", async () => {
   // given
   const buffer = Buffer.from(JSON.stringify({ ok: true }));
   mockGetObjectPromise.mockResolvedValue({Body:buffer});

   // when
   const result = await readFromS3("me.smithson.test-bucket", "file.test.json");

   // then
   expect(result.ok).toBe(true);
   expect(mockGetObject).toBeCalledWith({Bucket:"me.smithson.test-bucket", Key: "file.test.json"});
 });
```

Lets walk through what we are doing here:

We start by importing the `S3` constructor function and getting a mock for it:

```ts
import { S3 } from 'aws-sdk';

const S3Mock = mocked(S3);
```

When we use the S3 object we are doing this `s3.getObject(..).promise()`. To test this with mocke we want to be able to see when getObject is called and control the repsonse to the promise() function on the result. We do this by declaring some mocks using `jest.fn` for `getObject()` and `promise()`. We provide an implementation for the `getObject()` mock that returns an object with the promise mock.

```ts
const mockGetObjectPromise = jest.fn();
const mockGetObject = jest.fn(() => ({ promise: mockGetObjectPromise }));
```

We then wire these mocks up to the `S3` mock constructor using `mockImplementation`:

```ts
S3Mock.mockImplementation(() => ({ getObject: mockGetObject } as any));
```

In the test we setup the result for the `promise()` mock. Jest has a `mockResolvedValue` function which makes dealing with promises really easy:

```ts
const buffer = Buffer.from(JSON.stringify({ ok: true }));
mockGetObjectPromise.mockResolvedValue({Body:buffer});
```

We verify that the `getObject` Mock was called with the argument we expect:

```ts
expect(mockGetObject).toBeCalledWith({Bucket:"me.smithson.test-bucket", Key: "file.test.json"});
```

Jest's `mockRejectedValue` makes it easy to test failure cases:
```ts
 test("object does not exist", async () => {
   // given
   mockGetObjectPromise.mockRejectedValue({code:"NoSuchKey"});
  
   // when
  const result = await readFromS3("me.smithson.test-bucket", "file.test.json");

  // then
  expect(result).toBeUndefined();
 });
 ```

 Jest mocks can be incredibly useful when testing, however it is possible to overuse them. If your mocking is getting very complex, it may suggest that your design needs attention, or that you would benefit from creating your own mocks or test objects to use when testing.

 I have used examples of mocking external APIs or services, however this is something I try and avoid doing. It can be challenging to capture the behaviour of these in mocks, and if the behavious you have mocked is subletly different from how the service behaves your tests will deceive you.

 The approach I take is to call the external services through [Gateways](https://martinfowler.com/articles/gateway-pattern.html). Integration tests of the Gateway would verify that the service behaves as I expect for my use cases. I then mock the Gateway when testing the rest of the system. 






