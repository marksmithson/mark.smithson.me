---
date: "2022-12-04"
title: "SQL Refresh - Window Functions Part 1"
category: "Development"
---

When I first saw a Window Function, I dismissed it as another way to do a `GROUP BY`. Having learnt more about them, they are now another valuable tool in my SQL toolbox. 

Let's get started with an introduction looking at calculating the difference from the average flight time on a route for every flight on that route.

We will use the same sample database as the [previous article](/sql-refresh-common-table-expressions) (see https://postgrespro.com/docs/postgrespro/10/apjs02.html for the full database schema).

Flights are stored in the `flights` table which has `flight_id`, `flight_no`, `actual_arrival` and `actual_departure` columns.

To calculate the difference for the average flight time on a route, we will need the average flight time for that route, identified by the `flight_no`.

I will start by defining a [Common Table Expression](/sql-refresh-common-table-expressions) to calculate the flight times from that table, simplifying the SQL later on.

```sql
WITH 
  flight_times AS (
    SELECT
        flight_id,
        flight_no,
        actual_arrival - actual_departure as flight_time
    FROM
        flights
    WHERE
        STATUS = 'Arrived'
)
```

## Using GROUP BY

If I had been solving this before learning about Window Functions I would use a `GROUP BY` to calculate the average flight time for each route and then join that to the `flight_times` to produce the result.

```sql
WITH flight_times AS (
    SELECT
        flight_id,
        flight_no,
        actual_arrival - actual_departure AS flight_time
    FROM
        flights
    WHERE
        status = 'Arrived'
),
avg_flight_times AS ( 
  SELECT
      flight_no,
      avg(flight_time) AS avg_flight_time
  FROM
      flight_times
  GROUP BY
      flight_no
)

SELECT
    f.flight_id,
    f.flight_no,
    f.flight_time,
    a.avg_flight_time,
    f.flight_time - a.avg_flight_time AS avg_delta_flight_time
FROM
    flight_times f
INNER JOIN
    avg_flight_times a ON f.flight_no = a.flight_no
```

## Using Window Functions

A window function applies a function to a group of rows in a window frame. This frame is defined using an `OVER ()` clause. If we do not provide anything in the `OVER` clause all rows in the result set are used. For example:

```sql
WITH flight_times AS (
    SELECT
        flight_id,
        flight_no,
        actual_arrival - actual_departure AS flight_time
    FROM
        flights
    WHERE
        status = 'Arrived'

SELECT 
  flight_id,
  flight_no,
  flight_time,
  avg(flight_time) OVER () AS avg_flight_time
FROM 
  flight_times;
```

This returns the average of all flights in `avg_flight_time` which is the same for all rows

```txt
| flight_id  | flight_no  | flight_time               | avg_flight_time                |
------------------------------------------------------------------------------------
| 1         | PG0405    | 0 hours 55 mins 0.0 secs | 2 hours 8 mins 19.454121 secs |
| 2         | PG0404    | 0 hours 55 mins 0.0 secs | 2 hours 8 mins 19.454121 secs |
| 3         | PG0405    | 0 hours 55 mins 0.0 secs | 2 hours 8 mins 19.454121 secs |
| 14        | PG0402    | 0 hours 55 mins 0.0 secs | 2 hours 8 mins 19.454121 secs |
| 15        | PG0402    | 0 hours 55 mins 0.0 secs | 2 hours 8 mins 19.454121 secs |
```
If we include an `ORDER BY` in the `OVER` clause, then the window frame used by the function is the current row and all the rows sorted before the current row (including rows that have the same sort value). For example (using sum for clarity instead of avg):

```sql
WITH flight_times AS (
    SELECT
        flight_id,
        flight_no,
        actual_arrival - actual_departure AS flight_time
    FROM
        flights
    WHERE
        status = 'Arrived'
)

SELECT
  flight_id,
  flight_no,
  flight_time,
  sum(flight_time) OVER (ORDER BY flight_id) AS sum_flight_time
FROM
  flight_times
```

returns

```txt
| flight_id  | flight_no  | flight_time               | sum_flight_time           |
-------------------------------------------------------------------------------
| 1         | PG0405    | 0 hours 55 mins 0.0 secs | 0 hours 55 mins 0.0 secs |
| 2         | PG0404    | 0 hours 55 mins 0.0 secs | 1 hours 50 mins 0.0 secs |
| 3         | PG0405    | 0 hours 55 mins 0.0 secs | 2 hours 45 mins 0.0 secs |
| 14        | PG0402    | 0 hours 55 mins 0.0 secs | 3 hours 40 mins 0.0 secs |
| 15        | PG0402    | 0 hours 55 mins 0.0 secs | 4 hours 35 mins 0.0 secs |
```

We can see that the `sum_flight_time` is a running sum of the flight times of all the flights as the window frame for each row includes the current row and all rows before it.

Getting back to the task in hand, we don't want to specify an order as we want to consider all the rows for a `flight_no`. To achieve this we need to use `PARTITION BY` which specifies the column to group or partition the rows by.  When executing the window function, the window frame will be all rows within the same partition as the current row.  We `PARTITION BY flight_no` to group all the the flights with the same number to get the average:

```sql
WITH flight_times AS (
    SELECT
        flight_id,
        flight_no,
        actual_arrival - actual_departure AS flight_time
    FROM
        flights
    WHERE
        status = 'Arrived'
)

SELECT 
  flight_id,
  flight_no,
  flight_time,
  avg(flight_time) OVER (PARTITION BY flight_no) AS avg_flight_time,
FROM 
  flight_times;
```

We can then use this to calculate the delta from the average. PostgreSQL allows us to name window behaviour using the `WINDOW` clause, a useful trick to aid readability:

```sql
WITH flight_times AS (
    SELECT
        flight_id,
        flight_no,
        actual_arrival - actual_departure AS flight_time
    FROM
        flights
    WHERE
        status = 'Arrived'
)

SELECT 
  flight_id,
  flight_no,
  flight_time,
  avg(flight_time) OVER flight_no AS avg_flight_time
  flight_time - avg(flight_time) OVER flight_no AS avg_delta_flight_time
FROM 
  flight_times 
WINDOW 
  flight_no AS (PARTITION BY flight_no);
```

giving the result:

```txt

+--------+--------+-------------------------+-------------------------+------------------+
|flight_id flight_no flight_time                 avg_flight_time            avg_delta        |
+--------+--------+-------------------------+-------------------------+------------------+
| 20835    PG0001  2 hours 18 mins 0.0 secs  2 hours 19 mins 0.0 secs   1 mins 0.0 secs  |
| 20841    PG0001  2 hours 21 mins 0.0 secs  2 hours 19 mins 0.0 secs   -2 mins 0.0 secs |
| 20839    PG0001  2 hours 20 mins 0.0 secs  2 hours 19 mins 0.0 secs   -1 mins 0.0 secs |
| 20834    PG0001  2 hours 17 mins 0.0 secs  2 hours 19 mins 0.0 secs   2 mins 0.0 secs  |
| 32037    PG0002  2 hours 19 mins 0.0 secs  2 hours 20 mins 24.0 secs  1 mins 24.0 secs |
+--------+---------+-------------------------+-------------------------+-----------------+
```

A `GROUP BY` splits a result set into different buckets which we can then perform functions on. Window Functions allow us more flexibility in defining the window frames (buckets) allowing them to overlap and introduce additional functions that can be applied. In future articles I will explore the different ways we can define the window frames and the variety of functions we can apply to these rows.

If you can't wait then do checkout these links:
- https://www.postgresql.org/docs/current/tutorial-window.html
- https://www.postgresql.org/docs/current/functions-window.html

## Demo Database
For the examples I have used of the demo database available from: https://postgrespro.com/education/demodb

I used docker to run a postgresql server (14.5). My script to startup and load the database is:
```
curl https://edu.postgrespro.com/demo-small-en.zip
docker run -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
unzip demo-small-en.zip
psql -h localhost -f demo-small-en-20170815.sql -U postgres
```
