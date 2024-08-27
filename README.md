# swodlr-async-update

An asynchronous relational database update microservice for ensuring
synchronization between SWODLR microservices and its API database

## How it works

One of the design philosophies of microservices that SWODLR takes full
advantage of is distributed design. The idea being that the resources of one
microservice are intended for that microservice and the scope of its operation.
This is where async-update comes in. async-update serves as the bridge between
`swodlr-api` and SWODLR's various microservices. `async-update` takes in the
same `jobset` object as `raster-create` emits and performs database updates
on the jobs and their statuses.

`async-update` is triggered via an SQS queue which listens to an update topic
that `raster-create` publishes to. From here, `async-update` performs a
database lookup for the product ID associated with the `job` object its
processing. Depending on what the `job_status` is within the `job` object,
a new Status database entry will be created with the timestamp that
`async-update` processed the `job` at. The exact mapping logic for which State
is assigned to the Status entry can be found in the `lib/index.js`.
Additionally, within the same SQL transaction, if any granules are found,
individual Granule objects are created to track their URI. This process occurs
regardless of the `job_status`, however, `raster-create` will only include
granule URIs in the event of a successful job.

**Note:** `raster-create` emits verbose log information upon an error generating
a raster on the SDS. This information is not meant to be public. For one because
a user can't do anything about diagnosing the issue from their end, and two
because this error output can't be guaranteed to be sanitized for sensitive
information. This log information is instead only kept within the logs for the
microservices and is meant to only be used by system operators/developers. This
is one of the reasons why `async-update` does ***NOT*** publish the error data
directly to the database.
